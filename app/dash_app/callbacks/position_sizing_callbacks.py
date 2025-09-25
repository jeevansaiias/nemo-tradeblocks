"""Position Sizing callbacks for Kelly analysis and preference persistence."""

from __future__ import annotations

import hashlib
import json
import logging
from copy import deepcopy
from typing import Any, Dict, Optional

import dash_mantine_components as dmc
from dash import Input, Output, State, callback, ctx, no_update
import plotly.graph_objects as go

from app.calculations.shared import (
    calculate_initial_capital_from_trades,
    get_initial_capital_from_daily_log,
)
from app.data.models import Portfolio
from app.utils.kelly import calculate_kelly_metrics

logger = logging.getLogger(__name__)

STORE_VERSION = 1
SETTINGS_VERSION = 1
DEFAULT_TARGET_DRAWDOWN = 10
DEFAULT_STARTING_CAPITAL = 100000
DEFAULT_KELLY_PCT = 100.0
PRESETS = [
    ("Full Kelly", "full", 100.0, 1.0),
    ("Half Kelly", "half", 50.0, 0.5),
    ("Quarter Kelly", "quarter", 25.0, 0.25),
]


def _ensure_store(store_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(store_data, dict) or store_data.get("version") != STORE_VERSION:
        return {"version": STORE_VERSION, "portfolios": {}}

    return {
        "version": STORE_VERSION,
        "portfolios": dict(store_data.get("portfolios", {})),
    }


def _portfolio_fingerprint(portfolio_data: Optional[Dict[str, Any]]) -> Optional[str]:
    if not portfolio_data:
        return None

    payload = {
        "filename": portfolio_data.get("filename"),
        "upload_timestamp": portfolio_data.get("upload_timestamp"),
        "total_trades": portfolio_data.get("total_trades"),
    }

    if not any(payload.values()):
        return None

    try:
        serialized = json.dumps(payload, sort_keys=True, default=str)
    except (TypeError, ValueError):
        return None

    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:12]


def _collect_strategies(portfolio_data: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    strategies: Dict[str, Dict[str, Any]] = {}
    trades = portfolio_data.get("trades", []) or []
    for trade in trades:
        strategy = trade.get("strategy")
        if strategy:
            strategies.setdefault(strategy, {})
    return strategies


def _default_portfolio_settings(
    portfolio_data: Dict[str, Any],
    initial_capital: Optional[float] = None,
) -> Dict[str, Any]:
    starting_capital = None
    source = "default"

    if initial_capital is not None:
        try:
            if float(initial_capital) > 0:
                starting_capital = int(round(float(initial_capital)))
                source = "inferred"
        except (TypeError, ValueError):
            starting_capital = None

    if starting_capital is None:
        starting_capital = DEFAULT_STARTING_CAPITAL
        source = "default"

    return {
        "version": SETTINGS_VERSION,
        "portfolio": {
            "starting_capital": starting_capital,
            "starting_capital_source": source,
            "target_drawdown_pct": DEFAULT_TARGET_DRAWDOWN,
            "kelly_fraction_pct": DEFAULT_KELLY_PCT,
        },
        "strategies": _collect_strategies(portfolio_data),
    }


def _sync_settings(
    existing: Dict[str, Any],
    portfolio_data: Dict[str, Any],
    initial_capital: Optional[float] = None,
) -> Dict[str, Any]:
    if not existing or existing.get("version") != SETTINGS_VERSION:
        return _default_portfolio_settings(portfolio_data, initial_capital)

    updated = deepcopy(existing)
    portfolio_settings = updated.setdefault("portfolio", {})
    updated.setdefault("strategies", {})

    # Backwards compatibility for older stores
    legacy_choice = portfolio_settings.pop("kelly_fraction_choice", None)
    if "kelly_fraction_pct" not in portfolio_settings:
        mapping = {"full": 100.0, "half": 50.0, "quarter": 25.0}
        portfolio_settings["kelly_fraction_pct"] = mapping.get(legacy_choice, DEFAULT_KELLY_PCT)
    else:
        try:
            portfolio_settings["kelly_fraction_pct"] = max(
                0.0, float(portfolio_settings.get("kelly_fraction_pct", DEFAULT_KELLY_PCT))
            )
        except (TypeError, ValueError):
            portfolio_settings["kelly_fraction_pct"] = DEFAULT_KELLY_PCT

    for strategy in _collect_strategies(portfolio_data).keys():
        updated["strategies"].setdefault(strategy, {})

    if initial_capital is not None:
        try:
            parsed_capital = int(round(float(initial_capital)))
        except (TypeError, ValueError):
            parsed_capital = None

        if parsed_capital and parsed_capital > 0:
            current_capital = portfolio_settings.get("starting_capital")
            current_source = portfolio_settings.get("starting_capital_source", "default")
            manual_default = (
                current_source == "manual"
                and current_capital == DEFAULT_STARTING_CAPITAL
                and parsed_capital != DEFAULT_STARTING_CAPITAL
            )

            if (
                current_capital in (None, 0)
                or (
                    current_capital == DEFAULT_STARTING_CAPITAL
                    and parsed_capital != DEFAULT_STARTING_CAPITAL
                    and current_source != "manual"
                )
                or manual_default
            ):
                portfolio_settings["starting_capital"] = parsed_capital
                portfolio_settings["starting_capital_source"] = "inferred"
    else:
        current_capital = portfolio_settings.get("starting_capital")
        current_source = portfolio_settings.get("starting_capital_source")
        if current_capital in (None, 0):
            portfolio_settings["starting_capital"] = DEFAULT_STARTING_CAPITAL
            portfolio_settings.setdefault("starting_capital_source", "default")
        elif current_source is None:
            portfolio_settings["starting_capital_source"] = (
                "default" if current_capital == DEFAULT_STARTING_CAPITAL else "manual"
            )

    return updated


def _infer_starting_capital(
    portfolio_data: Optional[Dict[str, Any]],
    daily_log_data: Optional[Dict[str, Any]],
) -> Optional[float]:
    if not portfolio_data:
        return None

    trades = portfolio_data.get("trades") or []

    try:
        daily_entries = None
        if isinstance(daily_log_data, dict):
            daily_entries = daily_log_data.get("entries")
        elif isinstance(daily_log_data, list):
            daily_entries = daily_log_data

        if daily_entries:
            capital = get_initial_capital_from_daily_log(daily_entries)
        else:
            trade_dicts = []
            for trade in trades:
                if isinstance(trade, dict):
                    normalized = {}
                    for key, value in trade.items():
                        if hasattr(value, "isoformat"):
                            try:
                                normalized[key] = value.isoformat()
                                continue
                            except Exception:
                                pass
                        normalized[key] = value
                    trade_dicts.append(normalized)
                else:
                    trade_dicts.append(
                        {
                            "date_opened": (
                                getattr(trade, "date_opened", "").isoformat()
                                if hasattr(getattr(trade, "date_opened", None), "isoformat")
                                else getattr(trade, "date_opened", "")
                            ),
                            "time_opened": (
                                getattr(trade, "time_opened", "").isoformat()
                                if hasattr(getattr(trade, "time_opened", None), "isoformat")
                                else getattr(trade, "time_opened", "")
                            ),
                            "funds_at_close": getattr(trade, "funds_at_close", 0),
                            "pl": getattr(trade, "pl", 0),
                        }
                    )

            logger.debug(
                "Inferring capital from %d trade records (daily log present: %s)",
                len(trade_dicts),
                bool(daily_entries),
            )

            capital = calculate_initial_capital_from_trades(trade_dicts)

        capital = float(capital)
        if capital > 0:
            capital = int(round(capital))
            logger.info(
                "Inferred starting capital %.2f from %d trades%s",
                capital,
                len(trades),
                " using daily log" if daily_entries else "",
            )
            return capital
    except Exception as exc:  # pragma: no cover
        logger.warning("Failed to infer starting capital: %s", exc)

    return None


def register_position_sizing_callbacks(app):
    """Register all position sizing related callbacks."""

    @app.callback(
        Output("position-sizing-store", "data"),
        Input("current-portfolio-data", "data"),
        State("position-sizing-store", "data"),
        State("current-daily-log-data", "data"),
        prevent_initial_call=False,
    )
    def bootstrap_position_sizing_store(portfolio_data, store_data, daily_log_data):
        store = _ensure_store(store_data)

        if not portfolio_data:
            return store

        fingerprint = _portfolio_fingerprint(portfolio_data)
        if not fingerprint:
            return store

        inferred_capital = _infer_starting_capital(portfolio_data, daily_log_data)
        existing = store["portfolios"].get(fingerprint)
        synced = _sync_settings(existing, portfolio_data, inferred_capital)

        if existing == synced:
            return store_data or store

        logger.info("Initializing position sizing defaults for portfolio %s", fingerprint)
        store["portfolios"][fingerprint] = synced
        return store

    @app.callback(
        Output("ps-starting-capital-input", "value"),
        Output("ps-target-drawdown-input", "value"),
        Output("ps-kelly-fraction-input", "value"),
        Output("position-sizing-active-fingerprint", "data"),
        Input("position-sizing-store", "data"),
        Input("current-portfolio-data", "data"),
        State("current-daily-log-data", "data"),
        prevent_initial_call=False,
    )
    def hydrate_inputs(store_data, portfolio_data, daily_log_data):
        store = _ensure_store(store_data)
        fingerprint = _portfolio_fingerprint(portfolio_data)

        portfolio_settings = None
        if fingerprint:
            portfolio_entry = store["portfolios"].get(fingerprint)
            if portfolio_entry:
                portfolio_settings = portfolio_entry.get("portfolio", {})
        else:
            if portfolio_data:
                logger.warning(
                    "Could not compute portfolio fingerprint; position sizing preferences will not persist."
                )

        inferred_capital = _infer_starting_capital(portfolio_data, daily_log_data)

        if portfolio_settings is None and portfolio_data:
            portfolio_settings = _default_portfolio_settings(portfolio_data, inferred_capital)[
                "portfolio"
            ]

        starting_capital = None
        target_drawdown = DEFAULT_TARGET_DRAWDOWN
        fraction_pct = DEFAULT_KELLY_PCT
        source = "default"

        if portfolio_settings:
            starting_capital = portfolio_settings.get("starting_capital")
            source = portfolio_settings.get("starting_capital_source", "default")
            target_drawdown = portfolio_settings.get("target_drawdown_pct", DEFAULT_TARGET_DRAWDOWN)
            fraction_pct = portfolio_settings.get("kelly_fraction_pct", DEFAULT_KELLY_PCT)

        if source != "manual":
            if inferred_capital and (
                starting_capital in (None, 0) or starting_capital == DEFAULT_STARTING_CAPITAL
            ):
                starting_capital = inferred_capital
                source = "inferred"

        if starting_capital in (None, 0):
            starting_capital = DEFAULT_STARTING_CAPITAL
            if source != "manual":
                source = "default"

        try:
            starting_capital = int(round(float(starting_capital)))
        except (TypeError, ValueError):
            starting_capital = DEFAULT_STARTING_CAPITAL

        try:
            target_drawdown = float(target_drawdown)
        except (TypeError, ValueError):
            target_drawdown = DEFAULT_TARGET_DRAWDOWN

        try:
            fraction_pct = max(0.0, float(fraction_pct))
        except (TypeError, ValueError):
            fraction_pct = DEFAULT_KELLY_PCT

        logger.debug(
            "Hydrating inputs capital=%s (source=%s) drawdown=%s fraction=%s fingerprint=%s",
            starting_capital,
            source,
            target_drawdown,
            fraction_pct,
            fingerprint,
        )

        return starting_capital, target_drawdown, fraction_pct, fingerprint

    @app.callback(
        Output("position-sizing-store", "data", allow_duplicate=True),
        Output("ps-saved-feedback", "children"),
        Input("ps-starting-capital-input", "value"),
        Input("ps-target-drawdown-input", "value"),
        Input("ps-kelly-fraction-input", "value"),
        Input("ps-save-settings", "n_clicks"),
        Input("ps-reset-settings", "n_clicks"),
        State("position-sizing-store", "data"),
        State("position-sizing-active-fingerprint", "data"),
        State("current-portfolio-data", "data"),
        State("current-daily-log-data", "data"),
        prevent_initial_call=True,
    )
    def persist_preferences(
        starting_capital,
        target_drawdown,
        fraction_pct,
        save_clicks,
        reset_clicks,
        store_data,
        fingerprint,
        portfolio_data,
        daily_log_data,
    ):
        triggered = ctx.triggered_id
        if not triggered:
            return no_update, no_update

        if not fingerprint or not portfolio_data:
            logger.warning(
                "Position sizing save skipped: fingerprint=%s portfolio_present=%s",
                fingerprint,
                bool(portfolio_data),
            )
            return no_update, dmc.Text(
                "Upload a portfolio to enable position sizing controls.",
                size="xs",
                c="red.6",
            )

        store = _ensure_store(store_data)
        inferred_capital = _infer_starting_capital(portfolio_data, daily_log_data)
        portfolio_entry = _sync_settings(
            store["portfolios"].get(fingerprint),
            portfolio_data,
            inferred_capital,
        )

        message = no_update

        if triggered == "ps-reset-settings":
            portfolio_entry = _default_portfolio_settings(portfolio_data, inferred_capital)
            message = dmc.Text("Defaults restored", size="xs", c="orange.6")
        else:
            portfolio_entry.setdefault("portfolio", {})

            try:
                parsed_capital = (
                    int(round(float(starting_capital)))
                    if starting_capital not in (None, "")
                    else None
                )
            except (TypeError, ValueError):
                parsed_capital = None

            if parsed_capital is None:
                parsed_capital = DEFAULT_STARTING_CAPITAL

            portfolio_entry["portfolio"]["starting_capital"] = parsed_capital

            if triggered in {"ps-starting-capital-input", "ps-save-settings"}:
                portfolio_entry["portfolio"]["starting_capital_source"] = "manual"

            try:
                parsed_drawdown = (
                    float(target_drawdown)
                    if target_drawdown not in (None, "")
                    else DEFAULT_TARGET_DRAWDOWN
                )
            except (TypeError, ValueError):
                parsed_drawdown = DEFAULT_TARGET_DRAWDOWN

            portfolio_entry["portfolio"]["target_drawdown_pct"] = parsed_drawdown

            try:
                parsed_fraction = max(0.0, float(fraction_pct))
            except (TypeError, ValueError):
                parsed_fraction = DEFAULT_KELLY_PCT

            portfolio_entry["portfolio"]["kelly_fraction_pct"] = parsed_fraction

            if triggered == "ps-save-settings":
                message = dmc.Text("Settings saved", size="xs", c="teal.6")
            elif triggered in {
                "ps-starting-capital-input",
                "ps-target-drawdown-input",
                "ps-kelly-fraction-input",
            }:
                message = ""

        if store["portfolios"].get(fingerprint) == portfolio_entry:
            if triggered == "ps-reset-settings":
                return no_update, message
            return no_update, message

        updated_store = deepcopy(store)
        updated_store["portfolios"][fingerprint] = portfolio_entry

        return updated_store, message

    @app.callback(
        Output("ps-kelly-fraction-input", "value", allow_duplicate=True),
        Input("ps-fraction-preset-full", "n_clicks"),
        Input("ps-fraction-preset-half", "n_clicks"),
        Input("ps-fraction-preset-quarter", "n_clicks"),
        prevent_initial_call=True,
    )
    def apply_fraction_preset(full_clicks, half_clicks, quarter_clicks):
        preset_map = {
            "ps-fraction-preset-full": 100.0,
            "ps-fraction-preset-half": 50.0,
            "ps-fraction-preset-quarter": 25.0,
        }

        triggered = ctx.triggered_id
        if not triggered or preset_map.get(triggered) is None:
            return no_update

        return preset_map[triggered]

    @app.callback(
        Output("position-sizing-kelly-analysis", "children"),
        Output("position-sizing-fraction-tiles", "children"),
        Output("position-sizing-margin-chart", "figure"),
        Output("position-sizing-margin-warning", "children"),
        Input("current-portfolio-data", "data"),
        Input("position-sizing-store", "data"),
    )
    def update_kelly_analysis(portfolio_data, store_data):
        def _empty_outputs(message: str):
            placeholder_fig = go.Figure()
            placeholder_fig.update_layout(
                template="plotly_white",
                margin=dict(l=40, r=20, t=40, b=40),
                height=320,
            )
            return (
                dmc.Text(message, c="dimmed"),
                dmc.Alert(message, color="gray", variant="light"),
                placeholder_fig,
                "",
            )

        if not portfolio_data:
            return _empty_outputs("Upload a portfolio to see position sizing insights.")

        store = _ensure_store(store_data)
        fingerprint = _portfolio_fingerprint(portfolio_data)
        portfolio_settings = {}

        if fingerprint:
            portfolio_entry = store["portfolios"].get(fingerprint)
            if portfolio_entry:
                portfolio_settings = portfolio_entry.get("portfolio", {})

        starting_capital = portfolio_settings.get("starting_capital", DEFAULT_STARTING_CAPITAL)
        if starting_capital in (None, 0):
            starting_capital = DEFAULT_STARTING_CAPITAL

        fraction_pct = portfolio_settings.get("kelly_fraction_pct", DEFAULT_KELLY_PCT)
        try:
            fraction_pct = max(0.0, float(fraction_pct))
        except (TypeError, ValueError):
            fraction_pct = DEFAULT_KELLY_PCT

        target_drawdown = portfolio_settings.get("target_drawdown_pct", DEFAULT_TARGET_DRAWDOWN)

        fraction_multiplier = fraction_pct / 100.0
        matched_preset_key = None
        choice_label = None
        for label, key, pct, _ in PRESETS:
            if abs(fraction_pct - pct) < 0.1:
                matched_preset_key = key
                choice_label = label
                break

        if choice_label is None:
            choice_label = f"Custom ({fraction_pct:.1f}% Kelly)"

        try:
            portfolio = Portfolio(**portfolio_data)
            trades = portfolio.trades
            kelly_metrics = calculate_kelly_metrics(trades)

            if not (kelly_metrics.avg_win > 0 and kelly_metrics.avg_loss > 0):
                return _empty_outputs(
                    "Need both winning and losing trades to calculate Kelly metrics."
                )

            kelly_pct = kelly_metrics.percent
            b = kelly_metrics.payoff_ratio
            win_rate = kelly_metrics.win_rate
            avg_win = kelly_metrics.avg_win
            avg_loss = kelly_metrics.avg_loss
            applied_pct = kelly_pct * fraction_multiplier

            recommendation_text = (
                f"{choice_label} suggests allocating {applied_pct:.1f}% of capital per trade."
            )

            if kelly_pct <= 0:
                recommendation_details = "Kelly math is signaling negative expectancy. Consider pausing new risk or revisiting strategy assumptions."
                alert_color = "red"
            else:
                recommendation_details = f"With a target max drawdown of {target_drawdown:.0f}%, many traders start with partial Kelly before scaling."
                alert_color = "blue"

            kelly_summary = dmc.Stack(
                gap="md",
                children=[
                    dmc.Group(
                        [
                            dmc.Text("🧱 Kelly Criterion", fw=600, size="lg"),
                            dmc.Badge(choice_label, color="teal", variant="light"),
                        ],
                        justify="space-between",
                        align="center",
                    ),
                    dmc.Text(
                        f"{kelly_pct:.1f}%",
                        size="xl",
                        fw=700,
                        c="blue" if kelly_pct > 0 else "red",
                    ),
                    dmc.Text(
                        "Optimal position size based on win rate and payoff ratio",
                        size="sm",
                        c="dimmed",
                    ),
                    dmc.Divider(),
                    dmc.SimpleGrid(
                        cols=2,
                        spacing="md",
                        children=[
                            dmc.Stack(
                                [
                                    dmc.Text("Win Rate", size="xs", c="dimmed"),
                                    dmc.Text(f"{win_rate:.1%}", fw=600),
                                ],
                                gap="xs",
                            ),
                            dmc.Stack(
                                [
                                    dmc.Text("Avg Win/Loss Ratio", size="xs", c="dimmed"),
                                    dmc.Text(f"{b:.2f}x", fw=600),
                                ],
                                gap="xs",
                            ),
                            dmc.Stack(
                                [
                                    dmc.Text("Average Win", size="xs", c="dimmed"),
                                    dmc.Text(f"${avg_win:,.0f}", fw=600, c="green"),
                                ],
                                gap="xs",
                            ),
                            dmc.Stack(
                                [
                                    dmc.Text("Average Loss", size="xs", c="dimmed"),
                                    dmc.Text(f"${avg_loss:,.0f}", fw=600, c="red"),
                                ],
                                gap="xs",
                            ),
                        ],
                    ),
                    dmc.Alert(
                        children=[
                            dmc.Text("🎯 Recommendation", fw=600, size="sm"),
                            dmc.Text(recommendation_text, size="sm"),
                            dmc.Text(
                                recommendation_details,
                                size="sm",
                                c="dimmed",
                            ),
                        ],
                        color=alert_color,
                        variant="light",
                    ),
                ],
            )

            margin_rows = []
            for trade in trades:
                margin_req = getattr(trade, "margin_req", None)
                if margin_req is None:
                    continue

                date_opened = getattr(trade, "date_opened", None)
                if hasattr(date_opened, "isoformat"):
                    date_val = date_opened.isoformat()
                else:
                    date_val = date_opened

                margin_pct_capital = (
                    (margin_req / starting_capital) * 100 if starting_capital else None
                )

                funds_close = getattr(trade, "funds_at_close", None) or 0
                margin_rows.append(
                    {
                        "date": date_val,
                        "margin_pct_capital": margin_pct_capital,
                        "margin_req": margin_req,
                        "utilization_pct": (
                            (margin_req / funds_close) * 100 if funds_close else None
                        ),
                    }
                )

            margin_fig = go.Figure()
            margin_fig.update_layout(
                template="plotly_white",
                margin=dict(l=40, r=20, t=60, b=40),
                height=320,
                legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="left", x=0),
                yaxis=dict(title="% of Starting Capital", ticksuffix="%"),
            )

            dates = []
            margin_pct_values = []
            if margin_rows:
                margin_rows.sort(key=lambda row: row["date"] or "")
                for row in margin_rows:
                    dates.append(row["date"])
                    margin_pct_values.append(row["margin_pct_capital"] or 0)

                margin_fig.add_trace(
                    go.Scatter(
                        x=dates,
                        y=margin_pct_values,
                        mode="lines+markers",
                        name="Historical Margin %",
                        line=dict(color="#1f77b4", width=2),
                        marker=dict(size=6),
                    )
                )
            else:
                margin_fig.add_annotation(
                    text="Margin data unavailable",
                    xref="paper",
                    yref="paper",
                    x=0.5,
                    y=0.5,
                    showarrow=False,
                    font=dict(color="#6c6c6c"),
                )

            max_margin_pct = max([v for v in margin_pct_values if v is not None], default=0)

            selection_amount = starting_capital * applied_pct / 100
            selection_coverage = (applied_pct / max_margin_pct) if max_margin_pct else None

            fraction_tiles_children: list[Any] = [
                dmc.Paper(
                    children=[
                        dmc.Stack(
                            [
                                dmc.Text("Your Selection", fw=700),
                                dmc.Text(f"{fraction_pct:.1f}% of Kelly", size="sm", c="dimmed"),
                                dmc.Text(
                                    f"{applied_pct:.1f}% of capital",
                                    fw=600,
                                ),
                                dmc.Text(
                                    f"${selection_amount:,.0f}",
                                    size="lg",
                                    fw=700,
                                ),
                                dmc.Text(
                                    "Margin coverage: "
                                    + (
                                        f"{selection_coverage:.2f}x"
                                        if selection_coverage is not None
                                        else "--"
                                    ),
                                    size="xs",
                                    c="dimmed",
                                ),
                            ],
                            gap="xs",
                        )
                    ],
                    withBorder=True,
                    radius="md",
                    shadow="sm",
                    style={"border": "2px solid var(--mantine-color-teal-5)"},
                )
            ]

            if kelly_pct > 0 and starting_capital > 0:
                for label, key, pct, multiplier in PRESETS:
                    preset_applied_pct = max(kelly_pct * multiplier, 0)
                    fraction_amount = starting_capital * preset_applied_pct / 100
                    coverage_ratio = (
                        (preset_applied_pct / max_margin_pct) if max_margin_pct else None
                    )
                    covers = coverage_ratio is None or coverage_ratio >= 1
                    status_color = "teal" if covers else "orange"
                    status_text = "Covers Margin" if covers else "Shortfall"
                    highlight = key == matched_preset_key

                    fraction_tiles_children.append(
                        dmc.Paper(
                            children=[
                                dmc.Stack(
                                    [
                                        dmc.Group(
                                            [
                                                dmc.Text(label, fw=600),
                                                dmc.Badge(
                                                    status_text, color=status_color, variant="light"
                                                ),
                                            ],
                                            justify="space-between",
                                        ),
                                        dmc.Text(
                                            f"{preset_applied_pct:.1f}% of capital",
                                            size="sm",
                                            c="dimmed",
                                        ),
                                        dmc.Text(
                                            f"${fraction_amount:,.0f}",
                                            fw=700,
                                            size="lg",
                                        ),
                                        dmc.Text(
                                            "Margin coverage: "
                                            + (
                                                f"{coverage_ratio:.2f}x"
                                                if coverage_ratio is not None
                                                else "--"
                                            ),
                                            size="xs",
                                            c="dimmed",
                                        ),
                                    ],
                                    gap="xs",
                                )
                            ],
                            withBorder=True,
                            radius="md",
                            shadow="sm" if highlight else "xs",
                            style={
                                "border": (
                                    "2px solid var(--mantine-color-teal-5)"
                                    if highlight
                                    else "1px solid var(--mantine-color-gray-3)"
                                ),
                            },
                        )
                    )

                fraction_tiles_component = dmc.SimpleGrid(
                    cols=4,
                    spacing="md",
                    children=fraction_tiles_children,
                )
            else:
                fraction_tiles_component = dmc.Alert(
                    "Positive Kelly result required to show fraction sizing tiles.",
                    color="orange",
                    variant="light",
                )

            if margin_pct_values:
                for label, key, pct, multiplier in PRESETS:
                    level = max(kelly_pct * multiplier, 0)
                    line_color = "#2f9e44" if key == matched_preset_key else "#adb5bd"
                    dash_style = "solid" if key == matched_preset_key else "dot"
                    margin_fig.add_hline(
                        y=level,
                        line_dash=dash_style,
                        line_color=line_color,
                        annotation=dict(
                            text=f"{label} ({level:.1f}%)",
                            showarrow=False,
                            font=dict(color=line_color),
                            yanchor="bottom",
                        ),
                    )

                margin_fig.add_hline(
                    y=applied_pct,
                    line_dash="dash",
                    line_color="#ff922b",
                    annotation=dict(
                        text=f"Your selection ({applied_pct:.1f}%)",
                        showarrow=False,
                        font=dict(color="#ff922b"),
                        yanchor="bottom",
                    ),
                )

            margin_warning = ""
            if max_margin_pct and applied_pct < max_margin_pct:
                margin_warning = dmc.Alert(
                    children=[
                        dmc.Text("⚠️ Margin Shortfall", fw=600, size="sm"),
                        dmc.Text(
                            f"Historical max margin used {max_margin_pct:.1f}% of starting capital, exceeding your applied size ({applied_pct:.1f}%).",
                            size="sm",
                        ),
                    ],
                    color="orange",
                    variant="light",
                )

            return (
                kelly_summary,
                fraction_tiles_component,
                margin_fig,
                margin_warning,
            )

        except Exception as exc:  # pragma: no cover - defensive logging
            logger.error("Error calculating Kelly Criterion: %s", exc)
            return _empty_outputs(f"Error calculating Kelly Criterion: {exc}")
