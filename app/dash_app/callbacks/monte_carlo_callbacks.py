"""
Monte Carlo Risk Simulator Callbacks

Connects the Risk Simulator UI to the bootstrap Monte Carlo engine.
Handles simulation execution, chart updates, and statistics calculations.
"""

from dash import Input, Output, State, callback, no_update, html
import dash_mantine_components as dmc
from dash_iconify import DashIconify
import plotly.graph_objects as go
import plotly.express as px
import numpy as np
import logging

from app.calculations.monte_carlo import MonteCarloSimulator
from app.calculations.shared import (
    calculate_initial_capital_from_trades,
    get_initial_capital_from_daily_log,
)
from app.data.models import Portfolio, Trade, MonteCarloRequest
from app.utils.theme import get_theme_colors, apply_theme_layout

logger = logging.getLogger(__name__)


def register_monte_carlo_callbacks(app):
    """Register all Monte Carlo related callbacks"""

    @app.callback(
        [
            Output("mc-strategy-selection", "children"),
            Output("mc-initial-capital", "value"),
        ],
        [Input("current-portfolio-data", "data")],
        [State("current-daily-log-data", "data")],
        prevent_initial_call=False,
    )
    def update_strategy_options_and_capital(portfolio_data, daily_log_data):
        """Update strategy selection options and initial capital based on loaded portfolio"""
        default_strategy_options = dmc.Stack(
            [
                dmc.Checkbox(
                    label="All Strategies",
                    value="all",
                    checked=True,
                ),
            ],
            gap="xs",
        )

        if not portfolio_data:
            return [default_strategy_options], 100000  # Default capital

        try:
            # Parse portfolio data
            portfolio = Portfolio.parse_obj(portfolio_data)
            strategies = portfolio.strategies

            # Calculate initial capital from the data
            # Convert portfolio trades to dict format for existing functions
            trades_data = []
            for trade in portfolio.trades:
                trade_dict = {
                    "date_opened": trade.date_opened.isoformat(),
                    "time_opened": trade.time_opened.isoformat(),
                    "funds_at_close": trade.funds_at_close,
                    "pl": trade.pl,
                }
                trades_data.append(trade_dict)

            # Calculate initial capital using existing function
            if daily_log_data:
                try:
                    # Use daily log if available (more accurate)
                    initial_capital = get_initial_capital_from_daily_log(daily_log_data)
                except Exception:
                    # Fallback to trade data
                    initial_capital = calculate_initial_capital_from_trades(trades_data)
            else:
                initial_capital = calculate_initial_capital_from_trades(trades_data)

            # Ensure reasonable value
            if initial_capital <= 0:
                initial_capital = 100000

            # Create checkbox options
            strategy_options = [
                dmc.Checkbox(
                    label="All Strategies",
                    value="all",
                    checked=True,
                )
            ]

            for strategy in strategies:
                trade_count = len([t for t in portfolio.trades if t.strategy == strategy])
                strategy_options.append(
                    dmc.Checkbox(
                        label=f"{strategy} ({trade_count} trades)",
                        value=strategy,
                        checked=False,
                    )
                )

            return [
                dmc.Stack(
                    strategy_options,
                    gap="xs",
                )
            ], int(initial_capital)

        except Exception as e:
            logger.error(f"Error updating strategy options and capital: {str(e)}")
            return [default_strategy_options], 100000

    @app.callback(
        [
            Output("mc-equity-curve", "figure"),
            Output("mc-return-distribution", "figure"),
            Output("mc-drawdown-analysis", "figure"),
            Output("mc-expected-return", "children"),
            Output("mc-expected-return-desc", "children"),
            Output("mc-var-95", "children"),
            Output("mc-var-95-desc", "children"),
            Output("mc-prob-profit", "children"),
            Output("mc-prob-profit-desc", "children"),
            Output("mc-max-drawdown", "children"),
            Output("mc-max-drawdown-desc", "children"),
            Output("mc-status", "children"),
        ],
        [Input("mc-run-simulation", "n_clicks")],
        [
            State("current-portfolio-data", "data"),
            State("mc-num-simulations", "value"),
            State("mc-time-horizon", "value"),
            State("mc-bootstrap-method", "value"),
            State("mc-strategy-selection", "value"),
            State("mc-initial-capital", "value"),
            State("mc-confidence-levels", "value"),
            State("mc-log-scale", "checked"),
            State("mc-show-paths", "checked"),
        ],
        prevent_initial_call=True,
    )
    def run_monte_carlo_simulation(
        n_clicks,
        portfolio_data,
        num_simulations,
        time_horizon,
        bootstrap_method,
        selected_strategies,
        initial_capital,
        confidence_levels,
        log_scale,
        show_paths,
    ):
        """Run Monte Carlo simulation and update all charts and statistics"""
        if not n_clicks or not portfolio_data:
            return (
                create_placeholder_equity_curve(),
                create_placeholder_histogram(),
                create_placeholder_histogram(),
                "--",
                "Waiting for simulation",
                "--",
                "Waiting for simulation",
                "--",
                "Waiting for simulation",
                "--",
                "Waiting for simulation",
                "Ready to simulate",
            )

        try:
            # Parse portfolio data
            portfolio = Portfolio.parse_obj(portfolio_data)

            # Determine strategy filter
            strategy_filter = None
            if selected_strategies and "all" not in selected_strategies:
                # Use first selected strategy for now (could extend to multi-strategy)
                strategy_filter = selected_strategies[0] if selected_strategies else None

            # Parse confidence levels
            confidence_level_map = {
                "p5": 0.05,
                "p25": 0.25,
                "p50": 0.5,
                "p75": 0.75,
                "p95": 0.95,
            }
            parsed_confidence_levels = [
                confidence_level_map[level]
                for level in confidence_levels
                if level in confidence_level_map
            ]

            # Create Monte Carlo request
            request = MonteCarloRequest(
                strategy=strategy_filter,
                num_simulations=num_simulations,
                days_forward=int(time_horizon),
                confidence_levels=parsed_confidence_levels,
            )

            # Run simulation
            simulator = MonteCarloSimulator()
            use_daily_returns = bootstrap_method == "daily"
            result = simulator.run_bootstrap_simulation(portfolio, request, use_daily_returns)

            # Generate charts
            equity_curve_fig = create_equity_curve_chart(
                result, initial_capital, int(time_horizon), log_scale, show_paths
            )
            distribution_fig = create_return_distribution_chart(result)
            drawdown_fig = create_drawdown_analysis_chart(result, portfolio)

            # Calculate statistics
            expected_return_annual = result.expected_return * (252 / int(time_horizon))
            prob_profit = sum(1 for v in result.final_values if v > 0) / len(result.final_values)

            # Format statistics
            expected_return_text = f"{expected_return_annual:.1%}"
            expected_return_desc = f"Annualized based on {len(portfolio.trades)} trades"

            var_text = f"{result.var_95:.1%}"
            var_desc = f"95% chance return will be above this"

            prob_profit_text = f"{prob_profit:.1%}"
            prob_profit_desc = f"Out of {num_simulations} simulations"

            # Estimate max drawdown (simplified)
            max_dd = abs(min(result.final_values)) if result.final_values else 0
            max_dd_text = f"{max_dd:.1%}"
            max_dd_desc = f"95th percentile worst case"

            status_text = f"✅ Completed {num_simulations:,} simulations"

            return (
                equity_curve_fig,
                distribution_fig,
                drawdown_fig,
                expected_return_text,
                expected_return_desc,
                var_text,
                var_desc,
                prob_profit_text,
                prob_profit_desc,
                max_dd_text,
                max_dd_desc,
                status_text,
            )

        except Exception as e:
            logger.error(f"Error running Monte Carlo simulation: {str(e)}")
            error_status = f"❌ Error: {str(e)}"

            return (
                create_placeholder_equity_curve(),
                create_placeholder_histogram(),
                create_placeholder_histogram(),
                "Error",
                str(e),
                "Error",
                str(e),
                "Error",
                str(e),
                "Error",
                str(e),
                error_status,
            )

    @app.callback(
        [
            Output("mc-num-simulations", "value"),
            Output("mc-time-horizon", "value"),
            Output("mc-bootstrap-method", "value"),
            Output("mc-confidence-levels", "value"),
        ],
        [Input("mc-reset", "n_clicks")],
        prevent_initial_call=True,
    )
    def reset_simulation_parameters(n_clicks):
        """Reset all simulation parameters to defaults"""
        if n_clicks:
            return (
                1000,  # num_simulations
                "252",  # time_horizon (1 year)
                "trades",  # bootstrap_method
                ["p5", "p25", "p50", "p75", "p95"],  # confidence_levels
            )
        return no_update


def create_equity_curve_chart(
    result, initial_capital, days_forward, log_scale=False, show_paths=False
):
    """Create equity curve chart with percentile bands"""
    try:
        days = np.arange(0, days_forward)

        # Calculate percentile paths
        simulations_array = np.array(result.simulations)

        # Convert cumulative returns to portfolio values
        portfolio_values = initial_capital * (1 + simulations_array)

        # Calculate percentiles at each time step
        percentiles = {}
        if hasattr(result, "percentiles"):
            for p_name, p_val in result.percentiles.items():
                if p_name in ["p5", "p25", "p50", "p75", "p95"]:
                    percentiles[p_name] = np.percentile(portfolio_values, float(p_name[1:]), axis=0)

        fig = go.Figure()

        # Add percentile bands
        if "p95" in percentiles and "p5" in percentiles:
            # 5th-95th percentile band
            fig.add_trace(
                go.Scatter(
                    x=days,
                    y=percentiles["p95"],
                    line=dict(width=0),
                    mode="lines",
                    showlegend=False,
                    hoverinfo="skip",
                )
            )
            fig.add_trace(
                go.Scatter(
                    x=days,
                    y=percentiles["p5"],
                    fill="tonexty",
                    fillcolor="rgba(128,128,128,0.1)",
                    line=dict(width=0),
                    mode="lines",
                    name="5th-95th Percentile",
                    hoverinfo="skip",
                )
            )

        if "p75" in percentiles and "p25" in percentiles:
            # 25th-75th percentile band
            fig.add_trace(
                go.Scatter(
                    x=days,
                    y=percentiles["p75"],
                    line=dict(width=0),
                    mode="lines",
                    showlegend=False,
                    hoverinfo="skip",
                )
            )
            fig.add_trace(
                go.Scatter(
                    x=days,
                    y=percentiles["p25"],
                    fill="tonexty",
                    fillcolor="rgba(0,128,255,0.2)",
                    line=dict(width=0),
                    mode="lines",
                    name="25th-75th Percentile",
                    hoverinfo="skip",
                )
            )

        # Add median line
        if "p50" in percentiles:
            fig.add_trace(
                go.Scatter(
                    x=days,
                    y=percentiles["p50"],
                    mode="lines",
                    name="Median (50th)",
                    line=dict(color="blue", width=2),
                )
            )

        # Add individual paths if requested (max 20 for performance)
        if show_paths:
            sample_indices = np.random.choice(
                len(portfolio_values), min(20, len(portfolio_values)), replace=False
            )
            for i, idx in enumerate(sample_indices):
                fig.add_trace(
                    go.Scatter(
                        x=days,
                        y=portfolio_values[idx],
                        mode="lines",
                        name=f"Sample Path {i+1}" if i < 5 else None,
                        line=dict(color="rgba(128,128,128,0.3)", width=1),
                        showlegend=i < 5,
                        hoverinfo="skip",
                    )
                )

        # Add initial capital line
        fig.add_hline(
            y=initial_capital, line_dash="dash", line_color="red", annotation_text="Initial Capital"
        )

        fig.update_layout(
            title="Portfolio Value Projections",
            xaxis_title="Days Forward",
            yaxis_title="Portfolio Value ($)",
            yaxis_type="log" if log_scale else "linear",
            hovermode="x unified",
            showlegend=True,
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        )

        # Apply theme
        theme_colors = get_theme_colors({"theme": "light"})
        apply_theme_layout(fig, theme_colors)

        return fig

    except Exception as e:
        logger.error(f"Error creating equity curve chart: {str(e)}")
        return create_placeholder_equity_curve()


def create_return_distribution_chart(result):
    """Create return distribution histogram"""
    try:
        fig = go.Figure(
            data=[
                go.Histogram(
                    x=result.final_values,
                    nbinsx=50,
                    marker_color="rgba(0,128,255,0.7)",
                    marker_line_color="rgba(0,128,255,1)",
                    marker_line_width=1,
                )
            ]
        )

        # Add percentile lines
        for p_name, p_val in result.percentiles.items():
            if p_name in ["p5", "p50", "p95"]:
                color = "red" if p_name == "p5" else "blue" if p_name == "p50" else "green"
                fig.add_vline(
                    x=p_val,
                    line_dash="dash",
                    line_color=color,
                    annotation_text=f"{p_name.upper()}: {p_val:.1%}",
                )

        fig.update_layout(
            title="Final Return Distribution",
            xaxis_title="Cumulative Return",
            yaxis_title="Frequency",
            showlegend=False,
        )

        # Apply theme
        theme_colors = get_theme_colors({"theme": "light"})
        apply_theme_layout(fig, theme_colors)

        return fig

    except Exception as e:
        logger.error(f"Error creating return distribution chart: {str(e)}")
        return create_placeholder_histogram()


def create_drawdown_analysis_chart(result, portfolio):
    """Create drawdown analysis chart"""
    try:
        # Calculate drawdowns from simulation paths
        drawdowns = []
        for simulation in result.simulations:
            cumulative = np.cumsum(simulation)
            running_max = np.maximum.accumulate(cumulative)
            drawdown = (cumulative - running_max) / np.maximum(
                running_max, 0.001
            )  # Avoid division by zero
            drawdowns.extend(drawdown[drawdown < 0])  # Only negative drawdowns

        if not drawdowns:
            drawdowns = [0]  # Fallback

        fig = go.Figure(
            data=[
                go.Histogram(
                    x=np.array(drawdowns) * 100,  # Convert to percentage
                    nbinsx=30,
                    marker_color="rgba(255,128,0,0.7)",
                    marker_line_color="rgba(255,128,0,1)",
                    marker_line_width=1,
                )
            ]
        )

        # Add percentile lines
        percentiles = np.percentile(drawdowns, [5, 50, 95])
        for i, (p, color) in enumerate(zip(percentiles, ["red", "orange", "green"])):
            fig.add_vline(
                x=p * 100,
                line_dash="dash",
                line_color=color,
                annotation_text=f"P{[5,50,95][i]}: {p:.1%}",
            )

        fig.update_layout(
            title="Drawdown Distribution",
            xaxis_title="Drawdown (%)",
            yaxis_title="Frequency",
            showlegend=False,
        )

        # Apply theme
        theme_colors = get_theme_colors({"theme": "light"})
        apply_theme_layout(fig, theme_colors)

        return fig

    except Exception as e:
        logger.error(f"Error creating drawdown analysis chart: {str(e)}")
        return create_placeholder_histogram()


def create_placeholder_equity_curve():
    """Create a placeholder equity curve chart"""
    days = np.arange(0, 252)
    np.random.seed(42)
    median_path = 100000 * (1 + 0.0003 * days + 0.001 * np.random.randn(len(days)).cumsum())

    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=days,
            y=median_path,
            mode="lines",
            name="Example Projection",
            line=dict(color="gray", dash="dash"),
        )
    )

    fig.update_layout(
        title="Portfolio Value Projections (Load data and run simulation)",
        xaxis_title="Days Forward",
        yaxis_title="Portfolio Value ($)",
        annotations=[
            dict(
                text="Upload portfolio data and click 'Run Simulation' to see projections",
                xref="paper",
                yref="paper",
                x=0.5,
                y=0.5,
                xanchor="center",
                yanchor="middle",
                font=dict(size=16, color="gray"),
                showarrow=False,
            )
        ],
    )

    return fig


def create_placeholder_histogram():
    """Create a placeholder histogram"""
    data = np.random.normal(0.05, 0.15, 100)

    fig = go.Figure(
        data=[
            go.Histogram(
                x=data,
                nbinsx=20,
                marker_color="rgba(128,128,128,0.5)",
                marker_line_color="rgba(128,128,128,1)",
                marker_line_width=1,
            )
        ]
    )

    fig.update_layout(
        title="Run simulation to see results",
        xaxis_title="Return",
        yaxis_title="Frequency",
        showlegend=False,
        annotations=[
            dict(
                text="Click 'Run Simulation' to analyze your data",
                xref="paper",
                yref="paper",
                x=0.5,
                y=0.5,
                xanchor="center",
                yanchor="middle",
                font=dict(size=14, color="gray"),
                showarrow=False,
            )
        ],
    )

    return fig
