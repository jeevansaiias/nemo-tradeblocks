"""Position Sizing callbacks for Kelly analysis and preference persistence."""

from __future__ import annotations

import logging
import math
from collections import defaultdict
from datetime import datetime
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
from app.calculations.position_sizing import (
    PositionSizingCalculations,
    build_margin_statistics,
    calculate_position_sizing,
    extract_strategy_name,
)
from app.utils.theme import apply_theme_layout, get_theme_colors
from app.data.models import Portfolio
from app.dash_app.components.common import create_info_tooltip
from app.services.portfolio_service import resolve_portfolio_payload, resolve_daily_log_payload

logger = logging.getLogger(__name__)

DEFAULT_STARTING_CAPITAL = 100000
DEFAULT_KELLY_PCT = 100.0


def _infer_starting_capital(
    portfolio_data: Optional[Dict[str, Any]],
    daily_log_data: Optional[Dict[str, Any]],
) -> Optional[float]:
    if not portfolio_data:
        return None

    payload, portfolio_id = resolve_portfolio_payload(portfolio_data)
    if not payload:
        return None

    trades = payload.get("trades") or []

    daily_payload = resolve_daily_log_payload(daily_log_data, portfolio_id)

    try:
        daily_entries = None
        if isinstance(daily_payload, dict):
            daily_entries = daily_payload.get("entries")
        elif isinstance(daily_payload, list):
            daily_entries = daily_payload

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
            return capital
    except Exception as exc:  # pragma: no cover
        logger.warning("Failed to infer starting capital: %s", exc)

    return None


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

        payload, _ = resolve_portfolio_payload(portfolio_data)
        if not payload:
            return dmc.Alert(
                "Portfolio data unavailable. Try re-uploading your trades.",
                color="gray",
                variant="light",
            )

        # Collect unique strategies from the portfolio
        strategies = set()
        trades = payload.get("trades", []) or []
        for trade in trades:
            strategy = extract_strategy_name(trade)
            if strategy and strategy != "Uncategorized":
                strategies.add(strategy)

        if not strategies:
            return dmc.Alert(
                "No strategies detected in the uploaded portfolio.",
                color="gray",
                variant="light",
            )

        trade_counts: Dict[str, int] = defaultdict(int)
        for trade in trades:
            strategy_name = extract_strategy_name(trade)
            if strategy_name and strategy_name != "Uncategorized":
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
                    style={"position": "relative", "height": "100%"},
                    children=[
                        dmc.Badge(
                            f"{trade_counts.get(strategy_name, 0)} trades",
                            color="gray",
                            variant="light",
                            style={"position": "absolute", "top": "12px", "right": "12px"},
                        ),
                        dmc.Stack(
                            gap="sm",
                            justify="space-between",
                            style={"height": "100%"},
                            children=[
                                dmc.Text(
                                    strategy_name,
                                    fw=600,
                                    style={"paddingRight": "120px"},
                                ),
                                dmc.Stack(
                                    gap=4,
                                    style={"marginTop": "auto"},
                                    children=[
                                        dmc.Group(
                                            [
                                                dmc.Text("Kelly %", size="sm", fw=500),
                                                dmc.NumberInput(
                                                    id={
                                                        "type": "ps-strategy-kelly-input",
                                                        "strategy": strategy_name,
                                                    },
                                                    value=kelly_pct_value,
                                                    min=0,
                                                    max=200,
                                                    step=5,
                                                    allowNegative=False,
                                                    suffix="%",
                                                    style={"flex": 1},
                                                ),
                                            ],
                                            gap="sm",
                                            align="flex-end",
                                        ),
                                        dmc.Text(
                                            "Percent of each strategy's Kelly to apply",
                                            size="xs",
                                            c="dimmed",
                                        ),
                                    ],
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
        if not n_clicks:
            raise PreventUpdate
        return {"timestamp": datetime.now().isoformat(), "n_clicks": n_clicks}

    @app.callback(
        Output("ps-portfolio-kelly-summary", "children"),
        Output("ps-strategy-results", "children"),
        Output("ps-strategy-margin-chart", "figure"),
        Output("ps-strategy-margin-warning", "children"),
        Output("ps-results-container", "style"),
        Output("ps-margin-card-container", "style"),
        Output("ps-strategy-action-feedback", "children", allow_duplicate=True),
        Input("ps-run-strategy-analysis", "n_clicks"),
        Input("current-portfolio-data", "data"),
        Input("theme-store", "data"),
        State("ps-starting-capital-input", "value"),
        State("ps-kelly-fraction-input", "value"),
        State("ps-margin-calc-mode", "value"),
        State("current-daily-log-data", "data"),
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
        margin_calc_mode,
        daily_log_data,
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
                {"display": "none"},
                {"display": "none"},
                dmc.Text(
                    "Run the allocation to calculate metrics.",
                    size="xs",
                    c="dimmed",
                ),
            )

        if not portfolio_data:
            return _empty_outputs("Upload a portfolio to see Kelly analysis.")

        if n_clicks is None or n_clicks == 0:
            return _empty_outputs(
                "Adjust Kelly inputs and click Run Allocation to calculate metrics."
            )

        payload, portfolio_id = resolve_portfolio_payload(portfolio_data)
        if not payload:
            return _empty_outputs("Portfolio data unavailable. Try re-uploading your trades.")

        try:
            portfolio = Portfolio(**payload)
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.error("Error deserializing portfolio for Kelly analysis: %s", exc)
            return _empty_outputs(f"Error reading portfolio: {exc}")

        trades = portfolio.trades
        if not trades:
            return _empty_outputs("No trades available to analyze.")

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

        try:
            global_kelly_pct = (
                float(kelly_fraction_input)
                if kelly_fraction_input not in (None, "")
                else DEFAULT_KELLY_PCT
            )
        except (TypeError, ValueError):
            global_kelly_pct = DEFAULT_KELLY_PCT

        margin_mode = margin_calc_mode if margin_calc_mode else "fixed"

        daily_payload = resolve_daily_log_payload(daily_log_data, portfolio_id)

        calc_result: PositionSizingCalculations = calculate_position_sizing(
            trades,
            starting_capital,
            global_kelly_pct,
            strategy_kelly_values,
            strategy_kelly_ids,
            margin_mode,
            daily_payload,
        )

        portfolio_metrics = calc_result.portfolio_metrics
        if not (portfolio_metrics.avg_win > 0 and portfolio_metrics.avg_loss > 0):
            return _empty_outputs("Need both winning and losing trades to calculate Kelly metrics.")

        strategy_names = calc_result.strategy_names

        summary = calc_result.summary
        margin_timeline = calc_result.margin_timeline
        strategy_analysis_objs = calc_result.strategy_analysis

        strategy_analysis = [
            {
                "name": analysis.name,
                "trade_count": analysis.trade_count,
                "kelly_pct": analysis.kelly_pct,
                "input_pct": analysis.input_pct,
                "applied_pct": analysis.applied_pct,
                "win_rate": analysis.win_rate,
                "payoff_ratio": analysis.payoff_ratio,
                "avg_win": analysis.avg_win,
                "avg_loss": analysis.avg_loss,
                "max_margin_pct": analysis.max_margin_pct,
                "allocation_pct": analysis.allocation_pct,
                "allocation_dollars": analysis.allocation_dollars,
                "has_data": analysis.has_data,
            }
            for analysis in strategy_analysis_objs
        ]

        sorted_dates = margin_timeline.dates
        portfolio_margin_pct = margin_timeline.portfolio_pct
        strategy_margin_pct_series = margin_timeline.strategy_pct
        date_to_net_liq = margin_timeline.net_liq

        margin_fig = _blank_margin_figure(theme_data)

        hover_template = (
            "<b>Date:</b> %{x|%b %d, %Y}<br>" "<b>%{fullData.name}:</b> %{y:.2f}%<extra></extra>"
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
                    hovertemplate=hover_template,
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
                        hovertemplate=hover_template,
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

        theme_colors = get_theme_colors(theme_data)
        apply_theme_layout(
            margin_fig,
            theme_colors,
            margin=dict(l=60, r=30, t=80, b=60),
        )
        margin_fig.update_layout(hovermode="closest", hoverdistance=30)

        weighted_applied_pct = summary.weighted_applied_pct
        applied_capital = summary.applied_capital

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
                                        content="Starting capital × weighted applied % after Kelly."
                                        "",
                                        detailed_content="This is your base capital multiplied by the portfolio's weighted applied percentage after Kelly sizing. It reflects how much of your starting capital would be put to work under the current settings.",
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
            payoff_ratio_display = (
                f"{analysis['payoff_ratio']:.2f}x"
                if math.isfinite(analysis["payoff_ratio"]) and analysis["payoff_ratio"] > 0
                else "--"
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
                                dmc.Box(
                                    dmc.Text(
                                        analysis["name"], fw=600, style={"paddingRight": "180px"}
                                    ),
                                    style={
                                        "minHeight": "72px",
                                        "display": "flex",
                                        "alignItems": "center",
                                    },
                                ),
                                dmc.Divider(variant="dashed"),
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
                                dmc.Group(
                                    [
                                        dmc.Stack(
                                            [
                                                dmc.Text("Win Rate", size="xs", c="dimmed"),
                                                dmc.Text(
                                                    f"{analysis['win_rate']:.1%}", fw=600, ta="left"
                                                ),
                                            ],
                                            gap="xs",
                                        ),
                                        dmc.Stack(
                                            [
                                                dmc.Text(
                                                    "Avg Win/Loss Ratio", size="xs", c="dimmed"
                                                ),
                                                dmc.Text(payoff_ratio_display, fw=600, ta="right"),
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
                                        dmc.Stack(
                                            [
                                                dmc.Text("Average Win", size="xs", c="dimmed"),
                                                dmc.Text(
                                                    avg_win_display, fw=600, c="green", ta="left"
                                                ),
                                            ],
                                            gap="xs",
                                        ),
                                        dmc.Stack(
                                            [
                                                dmc.Text("Average Loss", size="xs", c="dimmed"),
                                                dmc.Text(
                                                    avg_loss_display, fw=600, c="red", ta="right"
                                                ),
                                            ],
                                            gap="xs",
                                        ),
                                    ],
                                    justify="space-between",
                                    align="center",
                                    w="100%",
                                ),
                                dmc.Divider(variant="dashed"),
                                dmc.Stack(
                                    gap="xs",
                                    children=[
                                        dmc.Group(
                                            [
                                                dmc.Group(
                                                    [
                                                        dmc.Text(
                                                            "Max margin used",
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
                                                    align="center",
                                                ),
                                                dmc.Text(
                                                    f"{analysis['max_margin_pct']:.1f}%",
                                                    size="sm",
                                                    fw=600,
                                                    ta="right",
                                                ),
                                            ],
                                            justify="space-between",
                                            align="center",
                                            w="100%",
                                        ),
                                        dmc.Group(
                                            [
                                                dmc.Group(
                                                    [
                                                        dmc.Text(
                                                            "Applied capital",
                                                            size="xs",
                                                            c="dimmed",
                                                        ),
                                                        create_info_tooltip(
                                                            title="💵 Applied Capital",
                                                            content="Starting capital × this strategy's applied % after Kelly.",
                                                            detailed_content="Use this as the maximum capital you intend to commit to the strategy when configuring backtest sizing rules.",
                                                            tooltip_id=f"ps-strategy-{analysis['name'].replace(' ', '-').lower()}-capital-detail",
                                                        ),
                                                    ],
                                                    gap=4,
                                                    align="center",
                                                ),
                                                dmc.Text(
                                                    f"${applied_capital_strategy:,.0f}",
                                                    size="sm",
                                                    fw=600,
                                                    ta="right",
                                                ),
                                            ],
                                            justify="space-between",
                                            align="center",
                                            w="100%",
                                        ),
                                        dmc.Group(
                                            [
                                                dmc.Group(
                                                    [
                                                        dmc.Text(
                                                            "Reference allocation %",
                                                            size="xs",
                                                            c="dimmed",
                                                        ),
                                                        create_info_tooltip(
                                                            title="📐 Reference Allocation %",
                                                            content="Historical max margin × your Kelly %.",
                                                            detailed_content="Use this percentage as the per-trade margin allocation guideline when setting up your backtest. It scales past requirements by the Kelly fraction you chose here.",
                                                            tooltip_id=f"ps-strategy-{analysis['name'].replace(' ', '-').lower()}-allocation",
                                                        ),
                                                    ],
                                                    gap=4,
                                                    align="center",
                                                ),
                                                dmc.Text(
                                                    f"{analysis['allocation_pct']:.1f}%",
                                                    size="sm",
                                                    fw=600,
                                                    ta="right",
                                                ),
                                            ],
                                            justify="space-between",
                                            align="center",
                                            w="100%",
                                        ),
                                        dmc.Group(
                                            [
                                                dmc.Group(
                                                    [
                                                        dmc.Text(
                                                            "Reference allocation $",
                                                            size="xs",
                                                            c="dimmed",
                                                        ),
                                                        create_info_tooltip(
                                                            title="💡 Reference Allocation $",
                                                            content="Starting capital × reference allocation %.",
                                                            detailed_content="Map this dollar amount to your backtest's per-trade allocation limit so it mirrors the Kelly-based guidance above.",
                                                            tooltip_id=f"ps-strategy-{analysis['name'].replace(' ', '-').lower()}-allocation-dollars",
                                                        ),
                                                    ],
                                                    gap=4,
                                                    align="center",
                                                ),
                                                dmc.Text(
                                                    f"${analysis['allocation_dollars']:,.0f}",
                                                    size="sm",
                                                    fw=600,
                                                    ta="right",
                                                ),
                                            ],
                                            justify="space-between",
                                            align="center",
                                            w="100%",
                                        ),
                                    ],
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

        margin_stats = build_margin_statistics(
            margin_timeline,
            strategy_analysis_objs,
            summary.weighted_applied_pct,
            global_kelly_pct,
        )

        if margin_stats:
            portfolio_stat = [s for s in margin_stats if s.get("is_portfolio")]
            strategy_stats = sorted(
                [s for s in margin_stats if not s.get("is_portfolio")],
                key=lambda x: x["expected"],
                reverse=True,
            )

            table_rows = []

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
                                dmc.Text("Projected Margin", size="sm"),
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

            for stat in portfolio_stat:
                table_rows.append(
                    dmc.TableTr(
                        [
                            dmc.TableTd(dmc.Text(stat["name"], fw=600)),
                            dmc.TableTd(
                                f"{stat['historical_max']:.1f}%",
                                style={"textAlign": "right"},
                            ),
                            dmc.TableTd(
                                f"{global_kelly_pct:.0f}%",
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

            for stat in strategy_stats:
                table_rows.append(
                    dmc.TableTr(
                        [
                            dmc.TableTd(dmc.Text(stat["name"], size="sm")),
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
                        dmc.List(
                            [
                                dmc.ListItem(
                                    dmc.Text(
                                        [
                                            dmc.Text("Historical Max: ", span=True, fw=500),
                                            "Highest margin usage observed historically.",
                                        ],
                                        size="xs",
                                    )
                                ),
                                dmc.ListItem(
                                    dmc.Text(
                                        [
                                            dmc.Text("Projected Margin: ", span=True, fw=500),
                                            "Projected margin need at your Kelly %. Example: 80% historical max with a 25% Kelly uses ~20% margin.",
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

        feedback = ""

        return (
            portfolio_summary,
            strategy_results_component,
            margin_fig,
            margin_warning,
            {"display": "block"},
            {"display": "block"},
            feedback,
        )
