"""Position Sizing callbacks for Kelly analysis and preference persistence."""

from __future__ import annotations

import logging
import math
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

import dash_mantine_components as dmc
from dash import ALL, Input, Output, State
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

DEFAULT_STARTING_CAPITAL = 100000
DEFAULT_KELLY_PCT = 100.0


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


def get_net_liq_from_daily_log(daily_log_data, date_str):
    """Extract net liquidity for a specific date from daily log.

    Args:
        daily_log_data: List or dict of daily log entries
        date_str: ISO format date string (YYYY-MM-DD)

    Returns:
        Net liquidity for that date, or None if not found
    """
    if not daily_log_data:
        return None

    # Handle both list and dict formats
    entries = daily_log_data
    if isinstance(daily_log_data, dict):
        entries = daily_log_data.get("entries", [])

    for entry in entries:
        entry_date = entry.get("date")
        if entry_date == date_str:
            return entry.get("net_liq")

    return None


def calculate_running_net_liq(trades, starting_capital, daily_log_data=None):
    """Calculate net liquidity at each point in time for compounding mode.

    Returns a dict mapping trade IDs to the net liquidity when that trade was opened.
    If daily_log_data is provided, uses actual net liquidity from the log.
    """
    # Sort trades by date_opened
    sorted_trades = sorted(
        trades,
        key=lambda t: (
            t.get("date_opened") or datetime.min.date(),
            t.get("time_opened") or datetime.min.time(),
        ),
    )

    net_liq_timeline = {}
    cumulative_pnl = 0
    closed_trades = []

    for trade in sorted_trades:
        trade_id = id(trade) if not isinstance(trade, dict) else hash(str(trade))
        trade_open = trade.get("date_opened")

        if not trade_open:
            net_liq_timeline[trade_id] = starting_capital
            continue

        # Try to get actual net liq from daily log
        date_str = trade_open.isoformat() if hasattr(trade_open, "isoformat") else str(trade_open)
        net_liq_from_log = (
            get_net_liq_from_daily_log(daily_log_data, date_str) if daily_log_data else None
        )

        if net_liq_from_log is not None:
            # Use actual net liq from daily log
            net_liq_at_open = net_liq_from_log
        else:
            # Calculate based on closed trades P&L
            for closed_trade in sorted_trades:
                closed_date = closed_trade.get("date_closed")
                if closed_date and closed_date < trade_open and closed_trade not in closed_trades:
                    # Try both 'pl' and 'pnl' field names
                    trade_pnl = closed_trade.get("pl") or closed_trade.get("pnl")
                    if trade_pnl is not None:
                        cumulative_pnl += trade_pnl
                    closed_trades.append(closed_trade)

            net_liq_at_open = starting_capital + cumulative_pnl

        net_liq_timeline[trade_id] = net_liq_at_open

    return net_liq_timeline


def calculate_margin_pct(trade, starting_capital, margin_mode="fixed", net_liq_timeline=None):
    """Calculate margin % based on selected mode.

    Args:
        trade: Trade data
        starting_capital: Initial capital
        margin_mode: "fixed" or "compounding"
        net_liq_timeline: Dict of trade IDs to net liquidity (for compounding mode)

    Returns:
        Margin percentage
    """
    margin_req = trade.get("margin_req", 0)

    if margin_mode == "compounding" and net_liq_timeline:
        trade_id = id(trade) if not isinstance(trade, dict) else hash(str(trade))
        denominator = net_liq_timeline.get(trade_id, starting_capital)
    else:
        denominator = starting_capital

    return (margin_req / denominator * 100) if denominator > 0 else 0


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
        Input("current-portfolio-data", "data"),
        State("current-daily-log-data", "data"),
        prevent_initial_call=False,
    )
    def hydrate_inputs(portfolio_data, daily_log_data):
        # Try to infer starting capital from portfolio data
        inferred_capital = _infer_starting_capital(portfolio_data, daily_log_data)
        starting_capital = inferred_capital if inferred_capital else DEFAULT_STARTING_CAPITAL

        return starting_capital, DEFAULT_KELLY_PCT

    @app.callback(
        Output("ps-strategy-input-grid", "children"),
        Input("current-portfolio-data", "data"),
        Input("ps-apply-trigger", "data"),
        State("ps-kelly-fraction-input", "value"),
    )
    def render_strategy_inputs(portfolio_data, apply_trigger, kelly_fraction_value):
        if not portfolio_data:
            return dmc.Alert(
                "Upload a portfolio to configure strategy sizing.",
                color="gray",
                variant="light",
            )

        # Collect unique strategies from the portfolio
        strategies = set()
        trades = portfolio_data.get("trades", []) or []
        for trade in trades:
            if isinstance(trade, dict):
                strategy = trade.get("strategy")
            else:
                strategy = getattr(trade, "strategy", None)
            if strategy:
                strategies.add(strategy)

        if not strategies:
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
            strategies,
            key=lambda name: (-trade_counts.get(name, 0), name.lower()),
        )

        for strategy_name in strategy_names:
            # Use applied Kelly value if apply trigger fired, otherwise use default
            if apply_trigger and kelly_fraction_value is not None:
                kelly_pct_value = kelly_fraction_value
            else:
                kelly_pct_value = DEFAULT_KELLY_PCT

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
        Output("ps-apply-trigger", "data"),
        Input("ps-apply-kelly-inline", "n_clicks"),
        prevent_initial_call=True,
    )
    def trigger_apply(n_clicks):
        logger.info(f"BUTTON CLICKED! n_clicks = {n_clicks}")
        print(f"BUTTON CLICKED! n_clicks = {n_clicks}")  # Force print to terminal
        if not n_clicks:
            raise PreventUpdate
        return {"timestamp": datetime.now().isoformat(), "n_clicks": n_clicks}

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
        State("ps-margin-calc-mode", "value"),
        State("current-daily-log-data", "data"),
        prevent_initial_call=True,
    )
    def run_strategy_analysis(
        n_clicks,
        portfolio_data,
        theme_data,
        starting_capital_input,
        kelly_fraction_input,
        margin_calc_mode,
        daily_log_data,
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

        # Only run when button is clicked, not on portfolio load
        if n_clicks is None or n_clicks == 0:
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

        # Build strategy kelly settings using global Kelly fraction
        try:
            global_kelly_pct = (
                float(kelly_fraction_input)
                if kelly_fraction_input not in (None, "")
                else DEFAULT_KELLY_PCT
            )
        except (TypeError, ValueError):
            global_kelly_pct = DEFAULT_KELLY_PCT

        # Get unique strategies from portfolio
        unique_strategies = set()
        for trade in trades:
            if hasattr(trade, "strategy") and trade.strategy:
                unique_strategies.add(trade.strategy)

        # Apply the same Kelly percentage to all strategies
        strategies_settings = {}
        for strategy_name in unique_strategies:
            strategies_settings[strategy_name] = {"kelly_pct": global_kelly_pct}

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

        # Use the margin calculation mode from the UI
        margin_mode = margin_calc_mode if margin_calc_mode else "fixed"
        logger.info(f"Margin calculation mode: {margin_mode} (received: {margin_calc_mode})")

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

        # If in compounding mode, calculate running P&L for each date
        date_to_net_liq = {}
        if margin_mode == "compounding":
            # Build a map of date -> net liquidity
            cumulative_pnl = 0
            closed_dates_seen = set()

            # Log initial state
            logger.info(f"Starting compounding calculation with {len(trades)} trades")
            trades_with_pl = sum(1 for t in trades if getattr(t, "pl", None) is not None)
            logger.info(f"Trades with P&L data: {trades_with_pl}/{len(trades)}")

            for date_key in sorted_dates:
                # First check if we have actual net liq from daily log
                net_liq_from_log = (
                    get_net_liq_from_daily_log(daily_log_data, date_key) if daily_log_data else None
                )

                if net_liq_from_log is not None:
                    date_to_net_liq[date_key] = net_liq_from_log
                else:
                    # Calculate based on closed trades
                    for trade in trades:
                        date_closed = getattr(trade, "date_closed", None)
                        if date_closed:
                            if hasattr(date_closed, "isoformat"):
                                closed_str = date_closed.isoformat()
                            else:
                                try:
                                    closed_str = (
                                        datetime.fromisoformat(str(date_closed)).date().isoformat()
                                    )
                                except:
                                    continue
                            if closed_str <= date_key and closed_str not in closed_dates_seen:
                                # Use 'pl' field (Trade model uses 'pl' not 'pnl')
                                trade_pnl = getattr(trade, "pl", None)
                                if trade_pnl is not None:
                                    cumulative_pnl += trade_pnl
                                    logger.debug(
                                        f"Added P&L {trade_pnl} on {closed_str}, cumulative: {cumulative_pnl}"
                                    )
                                closed_dates_seen.add(closed_str)
                    date_to_net_liq[date_key] = starting_capital + cumulative_pnl

            # Log for debugging
            logger.info(
                f"Compounding mode: Cumulative P&L = ${cumulative_pnl:,.0f}, Final net liq = ${starting_capital + cumulative_pnl:,.0f}"
            )
            logger.info(
                f"Date range: {sorted_dates[0] if sorted_dates else 'N/A'} to {sorted_dates[-1] if sorted_dates else 'N/A'}"
            )
            logger.info(
                f"Net liq changes: {list(set(date_to_net_liq.values()))[:5]}"
            )  # Show first 5 unique values
            logger.info(f"Number of unique net liq values: {len(set(date_to_net_liq.values()))}")

        for date_key in sorted_dates:
            total_margin = margin_totals[date_key].get("__total__", 0.0)

            # Calculate denominator based on mode
            if margin_mode == "compounding":
                denominator = date_to_net_liq.get(date_key, starting_capital)
            else:
                denominator = starting_capital

            portfolio_margin_pct.append(
                (total_margin / denominator) * 100 if denominator > 0 else 0.0
            )
            for name in strategy_names:
                strategy_margin = margin_totals[date_key].get(name, 0.0)
                strategy_margin_pct_series[name].append(
                    (strategy_margin / denominator) * 100 if denominator > 0 else 0.0
                )

        margin_fig = _blank_margin_figure(theme_data)

        # Add mode indicator and calculation info
        if margin_mode == "compounding":
            final_net_liq = (
                date_to_net_liq.get(sorted_dates[-1], starting_capital)
                if sorted_dates
                else starting_capital
            )
            pnl_change = final_net_liq - starting_capital
            mode_text = f"Mode: Compounding Returns<br>Starting: ${starting_capital:,.0f}<br>Final Net Liq: ${final_net_liq:,.0f}<br>P&L Impact: ${pnl_change:+,.0f}"
        else:
            mode_text = f"Mode: Fixed Capital<br>Using: ${starting_capital:,.0f} throughout"

        margin_fig.add_annotation(
            text=mode_text,
            xref="paper",
            yref="paper",
            x=0.02,
            y=0.98,
            showarrow=False,
            font=dict(size=10),
            align="left",
            bgcolor="rgba(255, 255, 255, 0.8)",
            bordercolor="gray",
            borderwidth=1,
        )

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
                                        label="Mathematically optimal allocation based on win rate and payoff ratio",
                                        children=dmc.Badge(
                                            f"FULL KELLY {portfolio_metrics.percent:.1f}%",
                                            color=portfolio_color,
                                            variant="filled",
                                            size="lg",
                                        ),
                                    ),
                                    dmc.Tooltip(
                                        label="Your Kelly fraction applied to the optimal allocation",
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
                                dmc.Group(
                                    [
                                        dmc.Text(
                                            f"Max margin used: {analysis['max_margin_pct']:.1f}% of capital",
                                            size="xs",
                                            c="dimmed",
                                        ),
                                        create_info_tooltip(
                                            title="📊 Max Margin Used",
                                            content="Peak margin requirement observed historically for this strategy.",
                                            detailed_content="This represents the highest percentage of capital that was tied up as margin when this strategy had open positions. Higher values indicate more capital-intensive strategies.",
                                            tooltip_id=f"ps-strategy-{analysis['name'].replace(' ', '-').lower()}-margin",
                                        ),
                                    ],
                                    gap=4,
                                ),
                                dmc.Group(
                                    [
                                        dmc.Text(
                                            f"Applied capital: ${applied_capital_strategy:,.0f}",
                                            size="xs",
                                            c="dimmed",
                                        ),
                                        create_info_tooltip(
                                            title="💵 Applied Capital",
                                            content="Dollar amount allocated to this strategy based on Kelly settings.",
                                            detailed_content="This is your starting capital multiplied by this strategy's applied percentage. It represents the actual dollars available for this strategy's position sizing.",
                                            tooltip_id=f"ps-strategy-{analysis['name'].replace(' ', '-').lower()}-capital",
                                        ),
                                    ],
                                    gap=4,
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

        # Simple feedback without timestamp
        feedback = ""

        return (
            portfolio_summary,
            strategy_results_component,
            margin_fig,
            margin_warning,
            feedback,
        )
