"""Position Sizing callbacks for Kelly analysis and preference persistence."""

from __future__ import annotations

import hashlib
import json
import logging
import math
from collections import defaultdict
from copy import deepcopy
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import dash_mantine_components as dmc
from dash import ALL, Input, Output, State, callback, ctx, no_update
from dash.exceptions import PreventUpdate
from dash_iconify import DashIconify
import plotly.graph_objects as go

from app.calculations.shared import (
    calculate_initial_capital_from_trades,
    get_initial_capital_from_daily_log,
)
from app.data.models import Portfolio
from app.utils.kelly import calculate_kelly_metrics
from app.dash_app.components.common import create_info_tooltip

logger = logging.getLogger(__name__)

STORE_VERSION = 1
SETTINGS_VERSION = 1
DEFAULT_TARGET_DRAWDOWN = 10
DEFAULT_STARTING_CAPITAL = 100000
DEFAULT_KELLY_PCT = 100.0


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
            strategies.setdefault(
                strategy,
                {"kelly_pct": DEFAULT_KELLY_PCT},
            )
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

    collected = _collect_strategies(portfolio_data)
    for strategy, defaults in collected.items():
        strategy_entry = updated["strategies"].setdefault(strategy, {})
        try:
            current_pct = float(
                strategy_entry.get("kelly_pct", defaults.get("kelly_pct", DEFAULT_KELLY_PCT))
            )
        except (TypeError, ValueError):
            current_pct = DEFAULT_KELLY_PCT
        strategy_entry["kelly_pct"] = max(0.0, current_pct)

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


def _contains_component_id(node: Any, target_id: str) -> bool:
    """Return True if a serialized Dash component tree contains target id."""

    if node is None:
        return False

    if isinstance(node, dict):
        props = node.get("props", {})
        if props.get("id") == target_id:
            return True
        children = props.get("children")
        if isinstance(children, list):
            return any(_contains_component_id(child, target_id) for child in children)
        return _contains_component_id(children, target_id)

    if isinstance(node, list):
        return any(_contains_component_id(child, target_id) for child in node)

    return False


def _blank_margin_figure(theme_data=None) -> go.Figure:
    is_dark = theme_data and theme_data.get("resolved") == "dark"
    template = "plotly_dark" if is_dark else "plotly_white"

    figure = go.Figure()
    figure.update_layout(
        template=template,
        margin=dict(l=40, r=20, t=60, b=40),
        height=320,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="left", x=0),
        yaxis=dict(title="% of Starting Capital", ticksuffix="%"),
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
    )
    return figure


def register_position_sizing_callbacks(app):
    """Register all position sizing related callbacks."""

    @app.callback(
        Output("ps-starting-capital-input", "value"),
        Output("ps-kelly-fraction-input", "value"),
        Input("position-sizing-present", "data"),
        Input("current-portfolio-data", "data"),
        State("current-daily-log-data", "data"),
        prevent_initial_call=False,
    )
    def hydrate_inputs(tab_present, portfolio_data, daily_log_data):
        # Only update if Position Sizing tab is actually active
        if not tab_present:
            raise PreventUpdate

        # Try to infer starting capital from portfolio data
        inferred_capital = _infer_starting_capital(portfolio_data, daily_log_data)
        starting_capital = inferred_capital if inferred_capital else DEFAULT_STARTING_CAPITAL

        return starting_capital, DEFAULT_KELLY_PCT

    @app.callback(
        Output("ps-strategy-input-grid", "children"),
        Input("current-portfolio-data", "data"),
        Input("position-sizing-store", "data"),
    )
    def render_strategy_inputs(portfolio_data, store_data):
        store = _ensure_store(store_data)

        if not portfolio_data:
            return dmc.Alert(
                "Upload a portfolio to configure strategy sizing.",
                color="gray",
                variant="light",
            )

        fingerprint = _portfolio_fingerprint(portfolio_data)
        strategies_data: Dict[str, Dict[str, Any]] = {}

        if fingerprint:
            portfolio_entry = store["portfolios"].get(fingerprint, {})
            strategies_data = dict(portfolio_entry.get("strategies", {}))
        else:
            logger.warning(
                "Could not compute portfolio fingerprint; strategy inputs will not persist."
            )

        if not strategies_data:
            strategies_data = _collect_strategies(portfolio_data)

        if not strategies_data:
            return dmc.Alert(
                "No strategies detected in the uploaded portfolio.",
                color="gray",
                variant="light",
            )

        trades = portfolio_data.get("trades") or []
        trade_counts: Dict[str, int] = defaultdict(int)
        for trade in trades:
            if isinstance(trade, dict):
                strategy_name = trade.get("strategy")
            else:
                strategy_name = getattr(trade, "strategy", None)
            if strategy_name:
                trade_counts[strategy_name] += 1

        cards = []
        strategy_names = sorted(
            strategies_data.keys(),
            key=lambda name: (-trade_counts.get(name, 0), name.lower()),
        )

        for strategy_name in strategy_names:
            settings = strategies_data.get(strategy_name) or {}
            try:
                kelly_pct_value = float(settings.get("kelly_pct", DEFAULT_KELLY_PCT))
            except (TypeError, ValueError):
                kelly_pct_value = DEFAULT_KELLY_PCT
            kelly_pct_value = max(0.0, kelly_pct_value)

            cards.append(
                dmc.Paper(
                    withBorder=True,
                    radius="md",
                    shadow="xs",
                    p="md",
                    style={"position": "relative"},
                    children=[
                        # Badge positioned absolutely in top-right
                        dmc.Badge(
                            f"{trade_counts.get(strategy_name, 0)} trades",
                            color="gray",
                            variant="light",
                            style={"position": "absolute", "top": "12px", "right": "12px"},
                        ),
                        dmc.Stack(
                            gap="sm",
                            children=[
                                # Strategy name with padding to avoid badge overlap
                                dmc.Text(strategy_name, fw=600, style={"paddingRight": "100px"}),
                                dmc.NumberInput(
                                    id={
                                        "type": "ps-strategy-kelly-input",
                                        "strategy": strategy_name,
                                    },
                                    label="Kelly %",
                                    description="Percent of each strategy's Kelly to apply",
                                    value=kelly_pct_value,
                                    min=0,
                                    max=200,
                                    step=5,
                                    allowNegative=False,
                                    suffix="%",
                                ),
                            ],
                        ),
                    ],
                )
            )

        if not cards:
            return dmc.Alert(
                "No strategies detected in the uploaded portfolio.",
                color="gray",
                variant="light",
            )

        cols = min(3, max(1, len(cards)))
        return dmc.SimpleGrid(
            cols={"base": 1, "sm": 1, "md": min(2, cols), "lg": cols},
            spacing="lg",
            children=cards,
        )

    @app.callback(
        Output("ps-strategy-action-feedback", "children"),
        Output("position-sizing-store", "data"),
        Input("ps-apply-portfolio-kelly", "n_clicks"),
        State({"type": "ps-strategy-kelly-input", "strategy": ALL}, "id"),
        State("ps-kelly-fraction-input", "value"),
        State("position-sizing-store", "data"),
        State("current-portfolio-data", "data"),
        prevent_initial_call=True,
    )
    def apply_portfolio_kelly_to_strategies(
        n_clicks, strategy_ids, portfolio_kelly_pct, store_data, portfolio_data
    ):
        if not n_clicks:
            raise PreventUpdate

        # Ensure store exists
        store = _ensure_store(store_data)

        try:
            portfolio_value = (
                float(portfolio_kelly_pct) if portfolio_kelly_pct is not None else DEFAULT_KELLY_PCT
            )
        except (TypeError, ValueError):
            portfolio_value = DEFAULT_KELLY_PCT
        portfolio_value = max(0.0, portfolio_value)

        # If no strategies or portfolio data, return early
        if not strategy_ids or not portfolio_data:
            return (
                dmc.Text("No strategies to update.", size="xs", c="dimmed"),
                store,
            )

        # Get portfolio fingerprint to update the store
        fingerprint = _portfolio_fingerprint(portfolio_data)
        if fingerprint:
            # Ensure portfolio entry exists
            if fingerprint not in store["portfolios"]:
                store["portfolios"][fingerprint] = {"strategies": {}}

            # Update each strategy's kelly_pct in the store
            for comp_id in strategy_ids:
                if isinstance(comp_id, dict) and comp_id.get("strategy"):
                    strategy_name = comp_id.get("strategy")
                    if "strategies" not in store["portfolios"][fingerprint]:
                        store["portfolios"][fingerprint]["strategies"] = {}
                    if strategy_name not in store["portfolios"][fingerprint]["strategies"]:
                        store["portfolios"][fingerprint]["strategies"][strategy_name] = {}
                    store["portfolios"][fingerprint]["strategies"][strategy_name][
                        "kelly_pct"
                    ] = portfolio_value

        # Count valid strategies for feedback
        valid_strategies = sum(
            1 for comp_id in strategy_ids if isinstance(comp_id, dict) and comp_id.get("strategy")
        )

        feedback = dmc.Text(
            f"Applied {portfolio_value}% Kelly to {valid_strategies} strateg{'y' if valid_strategies == 1 else 'ies'}",
            size="xs",
            c="teal.6",
        )

        return feedback, store

    @app.callback(
        Output("ps-portfolio-kelly-summary", "children"),
        Output("ps-strategy-results", "children"),
        Output("ps-strategy-margin-chart", "figure"),
        Output("ps-strategy-margin-warning", "children"),
        Output("ps-strategy-action-feedback", "children", allow_duplicate=True),
        Input("ps-run-strategy-analysis", "n_clicks"),
        Input("current-portfolio-data", "data"),
        Input("theme-store", "data"),
        State("ps-starting-capital-input", "value"),
        State("ps-kelly-fraction-input", "value"),
        State({"type": "ps-strategy-kelly-input", "strategy": ALL}, "value"),
        State({"type": "ps-strategy-kelly-input", "strategy": ALL}, "id"),
        prevent_initial_call=True,
    )
    def run_strategy_analysis(
        n_clicks,
        portfolio_data,
        theme_data,
        starting_capital_input,
        kelly_fraction_input,
        strategy_kelly_values,
        strategy_kelly_ids,
    ):
        placeholder_fig = _blank_margin_figure(theme_data)

        def _empty_outputs(message: str):
            return (
                dmc.Text(message, c="dimmed"),
                dmc.Alert(message, color="gray", variant="light"),
                placeholder_fig,
                "",
                dmc.Text(
                    "Run the allocation to calculate metrics.",
                    size="xs",
                    c="dimmed",
                ),
            )

        if not portfolio_data:
            return _empty_outputs("Upload a portfolio to see Kelly analysis.")

        triggered_id = ctx.triggered_id
        if triggered_id != "current-portfolio-data" and (n_clicks is None or n_clicks == 0):
            return _empty_outputs(
                "Adjust Kelly inputs and click Run Allocation to calculate metrics."
            )

        try:
            portfolio = Portfolio(**portfolio_data)
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.error("Error deserializing portfolio for Kelly analysis: %s", exc)
            return _empty_outputs(f"Error reading portfolio: {exc}")

        trades = portfolio.trades
        if not trades:
            return _empty_outputs("No trades available to analyze.")

        # Get input values from UI
        try:
            starting_capital = (
                float(starting_capital_input)
                if starting_capital_input
                else DEFAULT_STARTING_CAPITAL
            )
        except (TypeError, ValueError):
            starting_capital = DEFAULT_STARTING_CAPITAL
        if starting_capital <= 0:
            starting_capital = DEFAULT_STARTING_CAPITAL

        # Build strategy kelly settings from UI inputs
        strategies_settings = {}
        if strategy_kelly_values and strategy_kelly_ids:
            for value, comp_id in zip(strategy_kelly_values, strategy_kelly_ids):
                if isinstance(comp_id, dict):
                    strategy_name = comp_id.get("strategy")
                    if strategy_name:
                        try:
                            kelly_pct = (
                                float(value) if value not in (None, "") else DEFAULT_KELLY_PCT
                            )
                        except (TypeError, ValueError):
                            kelly_pct = DEFAULT_KELLY_PCT
                        strategies_settings[strategy_name] = {"kelly_pct": kelly_pct}

        portfolio_metrics = calculate_kelly_metrics(trades)
        if not (portfolio_metrics.avg_win > 0 and portfolio_metrics.avg_loss > 0):
            return _empty_outputs("Need both winning and losing trades to calculate Kelly metrics.")

        strategy_trade_map: Dict[str, list] = defaultdict(list)
        trade_counts: Dict[str, int] = defaultdict(int)
        for trade in trades:
            strategy_name = getattr(trade, "strategy", None) or "Uncategorized"
            strategy_trade_map[strategy_name].append(trade)
            trade_counts[strategy_name] += 1
            strategies_settings.setdefault(strategy_name, {"kelly_pct": DEFAULT_KELLY_PCT})

        strategy_names = sorted(
            strategies_settings.keys(),
            key=lambda name: (-trade_counts.get(name, 0), name.lower()),
        )

        margin_totals: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))
        for trade in trades:
            margin_req = getattr(trade, "margin_req", None)
            if margin_req in (None, 0):
                continue
            try:
                margin_value = float(margin_req)
            except (TypeError, ValueError):
                continue

            date_opened = getattr(trade, "date_opened", None)
            date_closed = getattr(trade, "date_closed", None)
            if not date_opened:
                continue

            # Ensure we have date objects to iterate across the holding period
            if hasattr(date_opened, "isoformat"):
                start_date = date_opened
            else:
                try:
                    start_date = datetime.fromisoformat(str(date_opened)).date()
                except ValueError:
                    continue

            if date_closed:
                if hasattr(date_closed, "isoformat"):
                    end_date = date_closed
                else:
                    try:
                        end_date = datetime.fromisoformat(str(date_closed)).date()
                    except ValueError:
                        end_date = start_date
            else:
                end_date = start_date

            if end_date < start_date:
                end_date = start_date

            strategy_name = getattr(trade, "strategy", None) or "Uncategorized"

            current_date = start_date
            while current_date <= end_date:
                date_key = current_date.isoformat()
                margin_totals[date_key][strategy_name] += margin_value
                margin_totals[date_key]["__total__"] += margin_value
                current_date += timedelta(days=1)

        sorted_dates = sorted(margin_totals.keys())
        portfolio_margin_pct = []
        strategy_margin_pct_series: Dict[str, list] = {name: [] for name in strategy_names}
        for date_key in sorted_dates:
            total_margin = margin_totals[date_key].get("__total__", 0.0)
            portfolio_margin_pct.append(
                (total_margin / starting_capital) * 100 if starting_capital else 0.0
            )
            for name in strategy_names:
                strategy_margin = margin_totals[date_key].get(name, 0.0)
                strategy_margin_pct_series[name].append(
                    (strategy_margin / starting_capital) * 100 if starting_capital else 0.0
                )

        margin_fig = _blank_margin_figure(theme_data)
        if sorted_dates:
            margin_fig.add_trace(
                go.Scatter(
                    x=sorted_dates,
                    y=portfolio_margin_pct,
                    mode="lines+markers",
                    name="Portfolio",
                    line=dict(width=3),
                    marker=dict(size=6),
                )
            )
            for name in strategy_names:
                series = strategy_margin_pct_series.get(name, [])
                if not any(series):
                    continue
                margin_fig.add_trace(
                    go.Scatter(
                        x=sorted_dates,
                        y=series,
                        mode="lines",
                        name=name,
                        line=dict(dash="dot"),
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

        strategy_analysis = []
        total_applied_weight = 0.0
        total_trades = len(trades)
        for name in strategy_names:
            strat_trades = strategy_trade_map.get(name, [])
            trade_count = len(strat_trades)
            metrics = calculate_kelly_metrics(strat_trades)
            raw_input_pct = strategies_settings.get(name, {}).get("kelly_pct", DEFAULT_KELLY_PCT)
            try:
                input_pct = max(0.0, float(raw_input_pct))
            except (TypeError, ValueError):
                input_pct = DEFAULT_KELLY_PCT

            applied_pct = metrics.percent * (input_pct / 100.0)
            margin_series = strategy_margin_pct_series.get(name, [])
            max_margin_pct = max(margin_series) if margin_series else 0.0
            strategy_analysis.append(
                {
                    "name": name,
                    "trade_count": trade_count,
                    "kelly_pct": metrics.percent,
                    "input_pct": input_pct,
                    "applied_pct": applied_pct,
                    "win_rate": metrics.win_rate,
                    "payoff_ratio": metrics.payoff_ratio,
                    "avg_win": metrics.avg_win,
                    "avg_loss": metrics.avg_loss,
                    "max_margin_pct": max_margin_pct,
                    "has_data": metrics.avg_win > 0 and metrics.avg_loss > 0,
                }
            )
            if trade_count > 0:
                total_applied_weight += applied_pct * trade_count

        weighted_applied_pct = (total_applied_weight / total_trades) if total_trades else 0.0
        applied_capital = starting_capital * weighted_applied_pct / 100.0

        portfolio_color = (
            "teal"
            if portfolio_metrics.percent > 0
            else "red" if portfolio_metrics.percent < 0 else "orange"
        )
        payoff_display = (
            f"{portfolio_metrics.payoff_ratio:.2f}x"
            if math.isfinite(portfolio_metrics.payoff_ratio) and portfolio_metrics.payoff_ratio > 0
            else "--"
        )

        portfolio_summary = dmc.Paper(
            withBorder=True,
            radius="md",
            p="lg",
            children=dmc.Stack(
                gap="lg",
                children=[
                    # Header with title and badges
                    dmc.Group(
                        [
                            dmc.Group(
                                [
                                    dmc.Text("Portfolio Kelly", fw=600, size="lg"),
                                    create_info_tooltip(
                                        title="📊 Portfolio Kelly",
                                        content="Aggregated Kelly criterion across all strategies, weighted by trade count. Shows the mathematical optimal allocation percentage.",
                                        detailed_content="The portfolio Kelly emerges from the weighted combination of individual strategy Kelly percentages. Strategies with more trades have greater influence on the overall portfolio allocation.",
                                        tooltip_id="ps-portfolio-kelly-header",
                                    ),
                                ],
                                gap="xs",
                            ),
                            dmc.Group(
                                [
                                    dmc.Tooltip(
                                        label=dmc.Stack(
                                            [
                                                dmc.Text(
                                                    "🎯 Full Kelly", c="blue", fw=600, size="sm"
                                                ),
                                                dmc.Text(
                                                    "Optimal Kelly percentage calculated from portfolio statistics",
                                                    size="xs",
                                                ),
                                                dmc.Text(
                                                    "This represents the mathematically optimal allocation based on your historical win rate and payoff ratio.",
                                                    size="xs",
                                                    c="dimmed",
                                                ),
                                            ],
                                            gap="xs",
                                        ),
                                        multiline=True,
                                        w=350,
                                        children=dmc.Badge(
                                            f"FULL KELLY {portfolio_metrics.percent:.1f}%",
                                            color=portfolio_color,
                                            variant="filled",
                                            size="lg",
                                        ),
                                    ),
                                    dmc.Tooltip(
                                        label=dmc.Stack(
                                            [
                                                dmc.Text(
                                                    "⚖️ Weighted Applied",
                                                    c="blue",
                                                    fw=600,
                                                    size="sm",
                                                ),
                                                dmc.Text(
                                                    "Actual allocation after applying your Kelly fraction settings",
                                                    size="xs",
                                                ),
                                                dmc.Text(
                                                    "This value reflects your risk preferences applied to the optimal Kelly allocation.",
                                                    size="xs",
                                                    c="dimmed",
                                                ),
                                            ],
                                            gap="xs",
                                        ),
                                        multiline=True,
                                        w=350,
                                        children=dmc.Badge(
                                            f"WEIGHTED APPLIED {weighted_applied_pct:.1f}%",
                                            color="blue",
                                            variant="light",
                                            size="lg",
                                        ),
                                    ),
                                ],
                                gap="xs",
                            ),
                        ],
                        justify="space-between",
                        align="center",
                    ),
                    dmc.Divider(variant="dashed"),
                    # Metrics grid
                    dmc.SimpleGrid(
                        cols={"base": 2, "sm": 2, "md": 4},
                        spacing="xl",
                        children=[
                            dmc.Stack(
                                [
                                    dmc.Group(
                                        [
                                            dmc.Text("Win Rate", size="xs", c="dimmed"),
                                            create_info_tooltip(
                                                title="🎲 Win Rate",
                                                content="Percentage of trades that were profitable across your entire portfolio.",
                                                detailed_content="Win rate alone doesn't determine profitability—a 30% win rate with large wins can outperform a 70% win rate with small wins. The Kelly formula considers both win rate and payoff ratio together.",
                                                tooltip_id="ps-portfolio-win-rate",
                                            ),
                                        ],
                                        gap=4,
                                    ),
                                    dmc.Text(
                                        f"{portfolio_metrics.win_rate:.1%}", fw=600, size="lg"
                                    ),
                                ],
                                gap=4,
                            ),
                            dmc.Stack(
                                [
                                    dmc.Group(
                                        [
                                            dmc.Text("Avg Win/Loss Ratio", size="xs", c="dimmed"),
                                            create_info_tooltip(
                                                title="📈 Win/Loss Ratio",
                                                content="Average winning trade divided by average losing trade, showing the asymmetry in your outcomes.",
                                                detailed_content="A ratio above 1.0 means your average win exceeds your average loss. Higher ratios allow for profitable trading even with lower win rates—this is the mathematical edge that Kelly sizing helps capture.",
                                                tooltip_id="ps-portfolio-payoff-ratio",
                                            ),
                                        ],
                                        gap=4,
                                    ),
                                    dmc.Text(payoff_display, fw=600, size="lg"),
                                ],
                                gap=4,
                            ),
                            dmc.Stack(
                                [
                                    dmc.Group(
                                        [
                                            dmc.Text("Average Win", size="xs", c="dimmed"),
                                            create_info_tooltip(
                                                title="💚 Average Win",
                                                content="Mean profit from winning trades across your portfolio.",
                                                detailed_content="This value represents the typical gain when a trade goes your way. Larger average wins relative to losses create positive expectancy even with modest win rates.",
                                                tooltip_id="ps-portfolio-avg-win",
                                            ),
                                        ],
                                        gap=4,
                                    ),
                                    dmc.Text(
                                        f"${portfolio_metrics.avg_win:,.0f}",
                                        fw=600,
                                        size="lg",
                                        c="teal.6",
                                    ),
                                ],
                                gap=4,
                            ),
                            dmc.Stack(
                                [
                                    dmc.Group(
                                        [
                                            dmc.Text("Average Loss", size="xs", c="dimmed"),
                                            create_info_tooltip(
                                                title="💔 Average Loss",
                                                content="Mean loss from losing trades across your portfolio.",
                                                detailed_content="This value shows the typical cost when a trade doesn't work out. Keeping losses small relative to wins is a key component of long-term trading success.",
                                                tooltip_id="ps-portfolio-avg-loss",
                                            ),
                                        ],
                                        gap=4,
                                    ),
                                    dmc.Text(
                                        f"-${portfolio_metrics.avg_loss:,.0f}",
                                        fw=600,
                                        size="lg",
                                        c="red.6",
                                    ),
                                ],
                                gap=4,
                            ),
                        ],
                    ),
                    dmc.Divider(variant="dashed"),
                    # Capital summary
                    dmc.SimpleGrid(
                        cols={"base": 1, "sm": 2},
                        spacing="md",
                        children=[
                            dmc.Group(
                                [
                                    dmc.Text(
                                        [
                                            dmc.Text(
                                                "Starting capital: ",
                                                span=True,
                                                size="sm",
                                                c="dimmed",
                                            ),
                                            dmc.Text(
                                                f"${starting_capital:,.0f}",
                                                span=True,
                                                size="sm",
                                                fw=500,
                                            ),
                                        ],
                                    ),
                                    create_info_tooltip(
                                        title="🏦 Starting Capital",
                                        content="The capital base used for all percentage calculations.",
                                        detailed_content="This is your initial account value or available trading capital. All Kelly percentages are calculated relative to this amount.",
                                        tooltip_id="ps-portfolio-starting-capital",
                                    ),
                                ],
                                gap="xs",
                            ),
                            dmc.Group(
                                [
                                    dmc.Text(
                                        [
                                            dmc.Text(
                                                "Weighted applied capital: ",
                                                span=True,
                                                size="sm",
                                                c="dimmed",
                                            ),
                                            dmc.Text(
                                                f"${applied_capital:,.0f}",
                                                span=True,
                                                size="sm",
                                                fw=500,
                                            ),
                                        ],
                                    ),
                                    create_info_tooltip(
                                        title="💰 Applied Capital",
                                        content="Total capital allocated after applying your Kelly fraction settings.",
                                        detailed_content="This represents the actual dollar amount allocated across all strategies based on your chosen Kelly percentages. The difference between this and starting capital shows your unallocated reserve.",
                                        tooltip_id="ps-portfolio-applied-capital",
                                    ),
                                ],
                                gap="xs",
                            ),
                        ],
                    ),
                ],
            ),
        )

        strategy_cards = []
        for analysis in strategy_analysis:
            payoff_ratio = analysis["payoff_ratio"]
            payoff_ratio_display = (
                f"{payoff_ratio:.2f}x" if math.isfinite(payoff_ratio) and payoff_ratio > 0 else "--"
            )
            avg_win_display = f"${analysis['avg_win']:,.0f}" if analysis["avg_win"] > 0 else "--"
            avg_loss_display = (
                f"-${analysis['avg_loss']:,.0f}" if analysis["avg_loss"] > 0 else "--"
            )
            applied_capital_strategy = starting_capital * analysis["applied_pct"] / 100.0
            base_color = (
                "teal"
                if analysis["kelly_pct"] > 0
                else "red" if analysis["kelly_pct"] < 0 else "orange"
            )

            # Prepare badge content
            badge_content = f"{analysis['trade_count']} trades"
            extra_badge = None
            if not analysis["has_data"]:
                extra_badge = dmc.Badge("Needs wins & losses", color="gray", variant="outline")
            elif analysis["kelly_pct"] <= 0:
                extra_badge = dmc.Badge("Negative Expectancy", color="red", variant="light")

            strategy_cards.append(
                dmc.Paper(
                    withBorder=True,
                    radius="md",
                    shadow="sm" if analysis["kelly_pct"] > 0 else "xs",
                    p="md",
                    style={"position": "relative"},
                    children=[
                        # Badge positioned absolutely in top-right
                        dmc.Group(
                            (
                                [
                                    dmc.Badge(badge_content, color="gray", variant="light"),
                                    extra_badge,
                                ]
                                if extra_badge
                                else [dmc.Badge(badge_content, color="gray", variant="light")]
                            ),
                            gap="xs",
                            style={"position": "absolute", "top": "12px", "right": "12px"},
                        ),
                        dmc.Stack(
                            gap="sm",
                            children=[
                                # Strategy name with padding to avoid badge overlap
                                dmc.Text(analysis["name"], fw=600, style={"paddingRight": "180px"}),
                                # Kelly percentages in horizontal layout
                                dmc.Group(
                                    [
                                        dmc.Text(
                                            f"Full Kelly {analysis['kelly_pct']:.1f}%",
                                            fw=600,
                                            c=base_color,
                                        ),
                                        dmc.Badge(
                                            f"Applied {analysis['applied_pct']:.1f}%",
                                            color="blue",
                                            variant="light",
                                        ),
                                    ],
                                    justify="space-between",
                                    align="center",
                                ),
                                dmc.Text(
                                    f"Kelly multiplier: {analysis['input_pct']:.0f}%",
                                    size="xs",
                                    c="dimmed",
                                ),
                                # Win Rate and Avg Win/Loss Ratio in a row
                                dmc.Group(
                                    [
                                        dmc.Stack(
                                            [
                                                dmc.Text("Win Rate", size="xs", c="dimmed"),
                                                dmc.Text(f"{analysis['win_rate']:.1%}", fw=600),
                                            ],
                                            gap="xs",
                                        ),
                                        dmc.Stack(
                                            [
                                                dmc.Text(
                                                    "Avg Win/Loss Ratio", size="xs", c="dimmed"
                                                ),
                                                dmc.Text(payoff_ratio_display, fw=600),
                                            ],
                                            gap="xs",
                                        ),
                                    ],
                                    justify="space-between",
                                    align="center",
                                    w="100%",
                                ),
                                # Average Win and Average Loss in a row
                                dmc.Group(
                                    [
                                        dmc.Stack(
                                            [
                                                dmc.Text("Average Win", size="xs", c="dimmed"),
                                                dmc.Text(avg_win_display, fw=600, c="green"),
                                            ],
                                            gap="xs",
                                        ),
                                        dmc.Stack(
                                            [
                                                dmc.Text("Average Loss", size="xs", c="dimmed"),
                                                dmc.Text(avg_loss_display, fw=600, c="red"),
                                            ],
                                            gap="xs",
                                        ),
                                    ],
                                    justify="space-between",
                                    align="center",
                                    w="100%",
                                ),
                                dmc.Text(
                                    f"Max margin used: {analysis['max_margin_pct']:.1f}% of capital",
                                    size="xs",
                                    c="dimmed",
                                ),
                                dmc.Text(
                                    f"Applied capital: ${applied_capital_strategy:,.0f}",
                                    size="xs",
                                    c="dimmed",
                                ),
                            ],
                        ),
                    ],
                )
            )

        if strategy_cards:
            strategy_results_component = dmc.SimpleGrid(
                cols={
                    "base": 1,
                    "sm": 1,
                    "md": min(2, len(strategy_cards)),
                    "lg": min(3, max(1, len(strategy_cards))),
                },
                spacing="lg",
                children=strategy_cards,
            )
        else:
            strategy_results_component = dmc.Alert(
                "No strategies available for analysis.",
                color="gray",
                variant="light",
            )

        # Calculate margin utilization statistics
        # Show all margin information transparently without arbitrary thresholds
        margin_stats = []

        # Portfolio-level margin statistics
        portfolio_max_margin_pct = max(portfolio_margin_pct) if portfolio_margin_pct else 0.0
        if portfolio_max_margin_pct and kelly_fraction_input:
            # Scale historical margin by current portfolio Kelly to get expected margin
            expected_portfolio_margin = portfolio_max_margin_pct * (kelly_fraction_input / 100.0)
            margin_stats.append(
                {
                    "name": "Portfolio",
                    "historical_max": portfolio_max_margin_pct,
                    "expected": expected_portfolio_margin,
                    "allocated": weighted_applied_pct,
                    "is_portfolio": True,
                }
            )

        # Individual strategy margin statistics
        for analysis in strategy_analysis:
            if analysis["max_margin_pct"] and analysis["input_pct"]:
                # Scale historical margin by this strategy's Kelly setting
                expected_margin = analysis["max_margin_pct"] * (analysis["input_pct"] / 100.0)
                margin_stats.append(
                    {
                        "name": analysis["name"],
                        "historical_max": analysis["max_margin_pct"],
                        "expected": expected_margin,
                        "allocated": analysis["applied_pct"],
                        "is_portfolio": False,
                    }
                )

        # Display margin statistics if any exist
        if margin_stats:
            # Sort strategies by expected margin (descending), with portfolio first
            portfolio_stat = [s for s in margin_stats if s["is_portfolio"]]
            strategy_stats = sorted(
                [s for s in margin_stats if not s["is_portfolio"]],
                key=lambda x: x["expected"],
                reverse=True,
            )

            # Create table rows for statistics
            table_rows = []

            # Header row with tooltips
            header_row = dmc.TableTr(
                [
                    dmc.TableTh("Strategy", style={"width": "30%"}),
                    dmc.TableTh(
                        dmc.Group(
                            [
                                dmc.Text("Historical Max", size="sm"),
                                dmc.Tooltip(
                                    label="Peak margin requirement as % of starting capital when trades were actually placed",
                                    children=dmc.ThemeIcon(
                                        DashIconify(icon="tabler:help", width=14),
                                        size="xs",
                                        variant="subtle",
                                        color="gray",
                                    ),
                                ),
                            ],
                            gap="xs",
                            justify="flex-end",
                        ),
                        style={"textAlign": "right", "width": "17.5%"},
                    ),
                    dmc.TableTh(
                        dmc.Group(
                            [
                                dmc.Text("Kelly %", size="sm"),
                                dmc.Tooltip(
                                    label="Your current Kelly fraction setting for this strategy",
                                    children=dmc.ThemeIcon(
                                        DashIconify(icon="tabler:help", width=14),
                                        size="xs",
                                        variant="subtle",
                                        color="gray",
                                    ),
                                ),
                            ],
                            gap="xs",
                            justify="flex-end",
                        ),
                        style={"textAlign": "right", "width": "17.5%"},
                    ),
                    dmc.TableTh(
                        dmc.Group(
                            [
                                dmc.Text("Expected Margin", size="sm"),
                                dmc.Tooltip(
                                    label="Projected margin need = Historical Max × (Kelly % / 100)",
                                    children=dmc.ThemeIcon(
                                        DashIconify(icon="tabler:help", width=14),
                                        size="xs",
                                        variant="subtle",
                                        color="gray",
                                    ),
                                ),
                            ],
                            gap="xs",
                            justify="flex-end",
                        ),
                        style={"textAlign": "right", "width": "17.5%"},
                    ),
                    dmc.TableTh(
                        dmc.Group(
                            [
                                dmc.Text("Allocated", size="sm"),
                                dmc.Tooltip(
                                    label="Capital allocated to this strategy = Optimal Kelly × (Kelly % / 100)",
                                    children=dmc.ThemeIcon(
                                        DashIconify(icon="tabler:help", width=14),
                                        size="xs",
                                        variant="subtle",
                                        color="gray",
                                    ),
                                ),
                            ],
                            gap="xs",
                            justify="flex-end",
                        ),
                        style={"textAlign": "right", "width": "17.5%"},
                    ),
                ]
            )

            # Portfolio row (if exists)
            for stat in portfolio_stat:
                table_rows.append(
                    dmc.TableTr(
                        [
                            dmc.TableTd(
                                dmc.Text(stat["name"], fw=600),
                            ),
                            dmc.TableTd(
                                f"{stat['historical_max']:.1f}%",
                                style={"textAlign": "right"},
                            ),
                            dmc.TableTd(
                                f"{kelly_fraction_input:.0f}%",
                                style={"textAlign": "right"},
                            ),
                            dmc.TableTd(
                                dmc.Text(
                                    f"{stat['expected']:.1f}%",
                                    fw=500,
                                    c=(
                                        "blue.6"
                                        if stat["expected"] <= stat["allocated"]
                                        else "orange.6"
                                    ),
                                ),
                                style={"textAlign": "right"},
                            ),
                            dmc.TableTd(
                                f"{stat['allocated']:.1f}%",
                                style={"textAlign": "right"},
                            ),
                        ]
                    )
                )

            # Strategy rows (all strategies)
            for stat in strategy_stats:
                table_rows.append(
                    dmc.TableTr(
                        [
                            dmc.TableTd(
                                dmc.Text(stat["name"], size="sm"),
                            ),
                            dmc.TableTd(
                                dmc.Text(f"{stat['historical_max']:.1f}%", size="sm"),
                                style={"textAlign": "right"},
                            ),
                            dmc.TableTd(
                                dmc.Text(
                                    f"{stat['expected'] / stat['historical_max'] * 100 if stat['historical_max'] else 0:.0f}%",
                                    size="sm",
                                ),
                                style={"textAlign": "right"},
                            ),
                            dmc.TableTd(
                                dmc.Text(
                                    f"{stat['expected']:.1f}%",
                                    size="sm",
                                    c=(
                                        "blue.6"
                                        if stat["expected"] <= stat["allocated"]
                                        else "orange.6"
                                    ),
                                ),
                                style={"textAlign": "right"},
                            ),
                            dmc.TableTd(
                                dmc.Text(f"{stat['allocated']:.1f}%", size="sm"),
                                style={"textAlign": "right"},
                            ),
                        ]
                    )
                )

            margin_warning = dmc.Paper(
                withBorder=True,
                radius="md",
                p="md",
                children=[
                    dmc.Group(
                        [
                            dmc.Text("📊 Margin Utilization Analysis", fw=600, size="md"),
                            dmc.Text(
                                "How your Kelly settings affect margin requirements",
                                size="xs",
                                c="dimmed",
                            ),
                        ],
                        justify="space-between",
                        align="center",
                        mb="sm",
                    ),
                    dmc.Alert(
                        [
                            dmc.Text("Understanding these numbers:", fw=500, size="sm", mb="xs"),
                            dmc.List(
                                [
                                    dmc.ListItem(
                                        dmc.Text(
                                            [
                                                dmc.Text("Historical Max: ", span=True, fw=500),
                                                "The peak margin used when these trades were actually placed, as % of your starting capital. ",
                                                "High values (>100%) mean the strategy used more margin than your capital base.",
                                            ],
                                            size="xs",
                                        )
                                    ),
                                    dmc.ListItem(
                                        dmc.Text(
                                            [
                                                dmc.Text("Kelly %: ", span=True, fw=500),
                                                "Your position sizing setting. At 10%, you're trading 10% of the optimal Kelly size.",
                                            ],
                                            size="xs",
                                        )
                                    ),
                                    dmc.ListItem(
                                        dmc.Text(
                                            [
                                                dmc.Text("Expected Margin: ", span=True, fw=500),
                                                "Projected margin need at your Kelly %. If Historical Max is 100% and Kelly is 10%, expect 10% margin usage.",
                                            ],
                                            size="xs",
                                        )
                                    ),
                                    dmc.ListItem(
                                        dmc.Text(
                                            [
                                                dmc.Text("Allocated: ", span=True, fw=500),
                                                "How much capital this strategy gets based on its calculated Kelly criterion and your Kelly % setting.",
                                            ],
                                            size="xs",
                                        )
                                    ),
                                ],
                                spacing="xs",
                                size="xs",
                            ),
                        ],
                        color="gray",
                        variant="light",
                        mb="md",
                    ),
                    dmc.Table(
                        striped=True,
                        highlightOnHover=True,
                        withTableBorder=True,
                        withColumnBorders=False,
                        children=[
                            dmc.TableThead([header_row]),
                            dmc.TableTbody(table_rows),
                        ],
                    ),
                    dmc.Alert(
                        dmc.Text(
                            [
                                dmc.Text("Color coding: ", span=True, fw=500),
                                dmc.Text("Blue", span=True, c="blue.6", fw=500),
                                " = Expected margin ≤ Allocated capital (good). ",
                                dmc.Text("Orange", span=True, c="orange.6", fw=500),
                                " = Expected margin > Allocated capital (may need more capital or lower Kelly %).",
                            ],
                            size="xs",
                        ),
                        color="blue",
                        variant="light",
                        mt="sm",
                    ),
                ],
            )
        else:
            margin_warning = ""

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        if triggered_id == "ps-run-strategy-analysis":
            feedback = dmc.Text(f"Updated at {timestamp}", size="xs", c="teal.6")
        else:
            feedback = dmc.Text(f"Auto-calculated at {timestamp}", size="xs", c="dimmed")

        return (
            portfolio_summary,
            strategy_results_component,
            margin_fig,
            margin_warning,
            feedback,
        )
