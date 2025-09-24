"""Position Sizing callbacks for Kelly analysis and preference persistence."""

import hashlib
import json
import logging
from copy import deepcopy
from typing import Any, Dict, Optional

import dash_mantine_components as dmc
from dash import Input, Output, State, callback, ctx, no_update

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
KELLY_FRACTION_LOOKUP = {
    "full": 1.0,
    "half": 0.5,
    "quarter": 0.25,
}


def _ensure_store(store_data: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Return a normalized copy of the position sizing store."""

    if not isinstance(store_data, dict) or store_data.get("version") != STORE_VERSION:
        return {"version": STORE_VERSION, "portfolios": {}}

    normalized = {
        "version": STORE_VERSION,
        "portfolios": dict(store_data.get("portfolios", {})),
    }
    return normalized


def _portfolio_fingerprint(portfolio_data: Optional[Dict[str, Any]]) -> Optional[str]:
    """Create a deterministic fingerprint for the uploaded portfolio."""

    if not portfolio_data:
        return None

    base_payload = {
        "filename": portfolio_data.get("filename"),
        "upload_timestamp": portfolio_data.get("upload_timestamp"),
        "total_trades": portfolio_data.get("total_trades"),
    }

    if not any(base_payload.values()):
        return None

    try:
        serialized = json.dumps(base_payload, sort_keys=True, default=str)
    except (TypeError, ValueError):
        return None

    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()[:12]


def _collect_strategies(portfolio_data: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    strategies = {}
    trades = portfolio_data.get("trades", []) or []
    for trade in trades:
        strategy = trade.get("strategy")
        if strategy:
            strategies.setdefault(strategy, {})
    return strategies


def _default_portfolio_settings(
    portfolio_data: Dict[str, Any], initial_capital: Optional[float] = None
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
            "target_drawdown_pct": DEFAULT_TARGET_DRAWDOWN,
            "kelly_fraction_choice": "full",
            "starting_capital_source": source,
        },
        "strategies": _collect_strategies(portfolio_data),
    }


def _sync_settings(
    existing: Dict[str, Any],
    portfolio_data: Dict[str, Any],
    initial_capital: Optional[float] = None,
) -> Dict[str, Any]:
    """Ensure strategy list & schema version are aligned with expectations."""

    if not existing or existing.get("version") != SETTINGS_VERSION:
        return _default_portfolio_settings(portfolio_data, initial_capital)

    updated = deepcopy(existing)
    updated.setdefault("portfolio", {})
    updated.setdefault("strategies", {})

    for strategy in _collect_strategies(portfolio_data).keys():
        updated["strategies"].setdefault(strategy, {})

    if initial_capital is not None:
        try:
            parsed_capital = int(round(float(initial_capital)))
        except (TypeError, ValueError):
            parsed_capital = None

        if parsed_capital and parsed_capital > 0:
            current_capital = updated["portfolio"].get("starting_capital")
            current_source = updated["portfolio"].get("starting_capital_source", "default")

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
                updated["portfolio"]["starting_capital"] = parsed_capital
                updated["portfolio"]["starting_capital_source"] = "inferred"
    else:
        current_capital = updated["portfolio"].get("starting_capital")
        current_source = updated["portfolio"].get("starting_capital_source")
        if current_capital in (None, 0):
            updated["portfolio"]["starting_capital"] = DEFAULT_STARTING_CAPITAL
            updated["portfolio"].setdefault("starting_capital_source", "default")
        elif current_source is None:
            if current_capital == DEFAULT_STARTING_CAPITAL:
                updated["portfolio"]["starting_capital_source"] = "default"
            else:
                updated["portfolio"]["starting_capital_source"] = "manual"

    return updated


def _infer_starting_capital(
    portfolio_data: Optional[Dict[str, Any]], daily_log_data: Optional[Dict[str, Any]]
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
                bool(daily_log_data),
            )

            capital = calculate_initial_capital_from_trades(trade_dicts)

        capital = float(capital)
        if capital > 0:
            capital = int(round(capital))
            logger.info(
                "Inferred starting capital %.2f from %d trades%s",
                capital,
                len(trades),
                " using daily log" if daily_log_data else "",
            )
            return capital
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("Failed to infer starting capital: %s", exc)

    return None


def register_position_sizing_callbacks(app):
    """Register all position sizing related callbacks"""

    @app.callback(
        Output("position-sizing-store", "data"),
        Input("current-portfolio-data", "data"),
        State("position-sizing-store", "data"),
        State("current-daily-log-data", "data"),
        prevent_initial_call=False,
    )
    def bootstrap_position_sizing_store(portfolio_data, store_data, daily_log_data):
        """Ensure a store entry exists for the active portfolio."""

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
        Output("ps-kelly-fraction-choice", "value"),
        Output("position-sizing-active-fingerprint", "data"),
        Input("position-sizing-store", "data"),
        Input("current-portfolio-data", "data"),
        State("current-daily-log-data", "data"),
        prevent_initial_call=False,
    )
    def hydrate_position_sizing_inputs(store_data, portfolio_data, daily_log_data):
        """Populate the position sizing controls from stored preferences."""

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
        kelly_choice = "full"

        starting_capital_source = "default"

        if portfolio_settings:
            starting_capital = portfolio_settings.get("starting_capital")
            starting_capital_source = portfolio_settings.get("starting_capital_source", "default")
            target_drawdown = portfolio_settings.get("target_drawdown_pct", DEFAULT_TARGET_DRAWDOWN)
            kelly_choice = portfolio_settings.get("kelly_fraction_choice", "full")

        if starting_capital_source != "manual":
            if inferred_capital and (
                starting_capital in (None, 0) or starting_capital == DEFAULT_STARTING_CAPITAL
            ):
                starting_capital = inferred_capital
                starting_capital_source = "inferred"

        if starting_capital in (None, 0):
            starting_capital = DEFAULT_STARTING_CAPITAL
            if starting_capital_source != "manual":
                starting_capital_source = "default"

        try:
            starting_capital = int(round(float(starting_capital)))
        except (TypeError, ValueError):
            starting_capital = DEFAULT_STARTING_CAPITAL

        try:
            target_drawdown = float(target_drawdown)
        except (TypeError, ValueError):
            target_drawdown = DEFAULT_TARGET_DRAWDOWN

        logger.debug(
            "Hydrating position sizing inputs: capital=%s (source=%s) drawdown=%s choice=%s fingerprint=%s",
            starting_capital,
            starting_capital_source,
            target_drawdown,
            kelly_choice,
            fingerprint,
        )

        return starting_capital, target_drawdown, kelly_choice, fingerprint

    @app.callback(
        Output("position-sizing-store", "data", allow_duplicate=True),
        Output("ps-saved-feedback", "children"),
        Input("ps-starting-capital-input", "value"),
        Input("ps-target-drawdown-input", "value"),
        Input("ps-kelly-fraction-choice", "value"),
        Input("ps-save-settings", "n_clicks"),
        Input("ps-reset-settings", "n_clicks"),
        State("position-sizing-store", "data"),
        State("position-sizing-active-fingerprint", "data"),
        State("current-portfolio-data", "data"),
        State("current-daily-log-data", "data"),
        prevent_initial_call=True,
    )
    def persist_position_sizing_preferences(
        starting_capital,
        target_drawdown,
        kelly_choice,
        save_clicks,
        reset_clicks,
        store_data,
        fingerprint,
        portfolio_data,
        daily_log_data,
    ):
        """Persist manual inputs back to local storage."""

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
            portfolio_entry["portfolio"]["kelly_fraction_choice"] = kelly_choice or "full"

            if triggered == "ps-save-settings":
                message = dmc.Text("Settings saved", size="xs", c="teal.6")
            elif triggered in {
                "ps-starting-capital-input",
                "ps-target-drawdown-input",
                "ps-kelly-fraction-choice",
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
        Output("position-sizing-kelly-analysis", "children"),
        Input("current-portfolio-data", "data"),
        Input("position-sizing-store", "data"),
    )
    def update_kelly_analysis(portfolio_data, store_data):
        """Update Kelly Criterion based on historical portfolio performance."""

        if not portfolio_data:
            return dmc.Text(
                "Load portfolio data to see position sizing recommendations", c="dimmed"
            )

        store = _ensure_store(store_data)
        fingerprint = _portfolio_fingerprint(portfolio_data)
        portfolio_settings = {}

        if fingerprint:
            portfolio_entry = store["portfolios"].get(fingerprint)
            if portfolio_entry:
                portfolio_settings = portfolio_entry.get("portfolio", {})

        selected_choice = portfolio_settings.get("kelly_fraction_choice", "full")
        target_drawdown = portfolio_settings.get("target_drawdown_pct", DEFAULT_TARGET_DRAWDOWN)
        fraction_multiplier = KELLY_FRACTION_LOOKUP.get(selected_choice, 1.0)

        choice_label = {
            "full": "Full Kelly",
            "half": "Half Kelly",
            "quarter": "Quarter Kelly",
        }.get(selected_choice, "Custom")

        try:
            portfolio = Portfolio(**portfolio_data)
            trades = portfolio.trades
            kelly_metrics = calculate_kelly_metrics(trades)

            if not (kelly_metrics.avg_win > 0 and kelly_metrics.avg_loss > 0):
                return [
                    dmc.Alert(
                        children="Insufficient trade data for Kelly Criterion calculation. Need both winning and losing trades.",
                        color="orange",
                        variant="light",
                    )
                ]

            kelly_pct = kelly_metrics.percent
            b = kelly_metrics.payoff_ratio
            win_rate = kelly_metrics.win_rate
            avg_win = kelly_metrics.avg_win
            avg_loss = kelly_metrics.avg_loss
            applied_pct = kelly_pct * fraction_multiplier

            recommendation_text = f"{choice_label} at {fraction_multiplier:.0%} of Kelly risk suggests allocating {applied_pct:.1f}% of capital per trade."

            if kelly_pct <= 0:
                recommendation_details = "Kelly math is signaling negative expectancy. Consider pausing new risk or reviewing strategy inputs."
                alert_color = "red"
            else:
                recommendation_details = f"With a target max drawdown of {target_drawdown:.0f}%, start by testing smaller fractions (Quarter/Half Kelly) before scaling."
                alert_color = "blue"

            return [
                dmc.Grid(
                    [
                        dmc.GridCol(
                            [
                                dmc.Paper(
                                    [
                                        dmc.Stack(
                                            [
                                                dmc.Group(
                                                    [
                                                        dmc.Text(
                                                            "🧱 Kelly Criterion",
                                                            fw=600,
                                                            size="lg",
                                                        ),
                                                        dmc.Badge(
                                                            choice_label,
                                                            color="teal",
                                                            variant="light",
                                                        ),
                                                    ],
                                                    justify="space-between",
                                                ),
                                                dmc.Text(
                                                    f"{kelly_pct:.1f}%",
                                                    size="xl",
                                                    fw=700,
                                                    c="blue" if kelly_pct > 0 else "red",
                                                ),
                                                dmc.Text(
                                                    "Optimal position size based on your win rate and payoff ratio",
                                                    size="sm",
                                                    c="dimmed",
                                                ),
                                                dmc.Divider(),
                                                dmc.SimpleGrid(
                                                    cols=2,
                                                    children=[
                                                        dmc.Stack(
                                                            [
                                                                dmc.Text(
                                                                    "Win Rate",
                                                                    size="xs",
                                                                    c="dimmed",
                                                                ),
                                                                dmc.Text(
                                                                    f"{win_rate:.1%}",
                                                                    fw=600,
                                                                ),
                                                            ],
                                                            gap="xs",
                                                        ),
                                                        dmc.Stack(
                                                            [
                                                                dmc.Text(
                                                                    "Avg Win/Loss Ratio",
                                                                    size="xs",
                                                                    c="dimmed",
                                                                ),
                                                                dmc.Text(
                                                                    f"{b:.2f}x",
                                                                    fw=600,
                                                                ),
                                                            ],
                                                            gap="xs",
                                                        ),
                                                        dmc.Stack(
                                                            [
                                                                dmc.Text(
                                                                    "Average Win",
                                                                    size="xs",
                                                                    c="dimmed",
                                                                ),
                                                                dmc.Text(
                                                                    f"${avg_win:,.0f}",
                                                                    fw=600,
                                                                    c="green",
                                                                ),
                                                            ],
                                                            gap="xs",
                                                        ),
                                                        dmc.Stack(
                                                            [
                                                                dmc.Text(
                                                                    "Average Loss",
                                                                    size="xs",
                                                                    c="dimmed",
                                                                ),
                                                                dmc.Text(
                                                                    f"${avg_loss:,.0f}",
                                                                    fw=600,
                                                                    c="red",
                                                                ),
                                                            ],
                                                            gap="xs",
                                                        ),
                                                    ],
                                                ),
                                                dmc.Alert(
                                                    children=[
                                                        dmc.Text(
                                                            "🎯 Recommendation",
                                                            fw=600,
                                                            size="sm",
                                                        ),
                                                        dmc.Text(
                                                            recommendation_text,
                                                            size="sm",
                                                        ),
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
                                            gap="md",
                                        ),
                                    ],
                                    p="lg",
                                    withBorder=True,
                                )
                            ],
                            span=12,
                        )
                    ]
                )
            ]

        except Exception as exc:  # pragma: no cover - defensive logging
            logger.error("Error calculating Kelly Criterion: %s", exc)
            return dmc.Alert(
                children=f"Error calculating Kelly Criterion: {exc}",
                color="red",
                variant="light",
            )
