"""
Monte Carlo Risk Simulator Callbacks

Connects the Risk Simulator UI to the bootstrap Monte Carlo engine.
Handles simulation execution, chart updates, and statistics calculations.
"""

from dash import Input, Output, State, callback, no_update, html, ctx
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
        Output("mc-seed-value", "disabled"),
        Input("mc-use-random-seed", "checked"),
    )
    def toggle_seed_input(use_fixed_seed):
        """Enable/disable seed value input based on switch"""
        return not use_fixed_seed  # Disabled when switch is OFF

    @app.callback(
        [
            Output("mc-strategy-selection", "data"),
            Output("mc-initial-capital", "value"),
        ],
        [Input("current-portfolio-data", "data")],
        [State("current-daily-log-data", "data")],
        prevent_initial_call=False,
    )
    def update_strategy_options_and_capital(portfolio_data, daily_log_data):
        """Update strategy selection options and initial capital based on loaded portfolio"""
        default_strategy_options = [{"value": "all", "label": "All Strategies"}]

        if not portfolio_data:
            return default_strategy_options, 100000  # Default capital

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

            # Create dropdown options
            strategy_options = [{"value": "all", "label": "All Strategies"}]

            for strategy in strategies:
                trade_count = len([t for t in portfolio.trades if t.strategy == strategy])
                strategy_options.append(
                    {"value": strategy, "label": f"{strategy} ({trade_count} trades)"}
                )

            return strategy_options, int(initial_capital)

        except Exception as e:
            logger.error(f"Error updating strategy options and capital: {str(e)}")
            return default_strategy_options, 100000

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
            Output("mc-best-case", "children"),
            Output("mc-best-case-desc", "children"),
            Output("mc-median-case", "children"),
            Output("mc-median-case-desc", "children"),
            Output("mc-worst-case", "children"),
            Output("mc-worst-case-desc", "children"),
            Output("mc-simulation-cache", "data"),
        ],
        [
            Input("mc-run-simulation", "n_clicks"),
            Input("mc-scale-selector", "value"),
            Input("mc-show-paths", "checked"),
        ],
        [
            State("current-portfolio-data", "data"),
            State("mc-num-simulations", "value"),
            State("mc-time-horizon", "value"),
            State("mc-bootstrap-method", "value"),
            State("mc-strategy-selection", "value"),
            State("mc-initial-capital", "value"),
            State("mc-trades-per-year", "value"),
            State("mc-use-random-seed", "checked"),
            State("mc-seed-value", "value"),
            State("mc-simulation-cache", "data"),
        ],
        prevent_initial_call=True,
    )
    def run_monte_carlo_simulation(
        n_clicks,
        scale_selector,
        show_paths,
        portfolio_data,
        num_simulations,
        time_horizon,
        bootstrap_method,
        selected_strategies,
        initial_capital,
        trades_per_year,
        use_random_seed,
        seed_value,
        cached_data,
    ):
        """Run Monte Carlo simulation and update all charts and statistics"""
        # Check if we're just updating chart display options
        triggered_id = ctx.triggered[0]["prop_id"].split(".")[0] if ctx.triggered else None

        if triggered_id in ["mc-scale-selector", "mc-show-paths"] and cached_data:
            # Just updating chart display with cached data
            result_data = cached_data["result"]
            initial_capital = cached_data["initial_capital"]
            time_horizon = cached_data["time_horizon"]

            # Recreate the result object (simplified)
            from types import SimpleNamespace

            result = SimpleNamespace(**result_data)

            # Generate updated chart - show all paths when enabled
            log_scale = scale_selector == "log"
            equity_curve_fig = create_equity_curve_chart(
                result, initial_capital, int(time_horizon), log_scale, show_paths
            )

            # Return updated chart with cached statistics and same cache
            return (
                equity_curve_fig,
                cached_data["distribution_fig"],
                cached_data["drawdown_fig"],
                cached_data["expected_return_text"],
                cached_data["expected_return_desc"],
                cached_data["var_text"],
                cached_data["var_desc"],
                cached_data["prob_profit_text"],
                cached_data["prob_profit_desc"],
                cached_data["max_dd_text"],
                cached_data["max_dd_desc"],
                cached_data.get("best_case_text", "--"),
                cached_data.get("best_case_desc", ""),
                cached_data.get("median_case_text", "--"),
                cached_data.get("median_case_desc", ""),
                cached_data.get("worst_case_text", "--"),
                cached_data.get("worst_case_desc", ""),
                cached_data,  # Keep same cache
            )

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
                "--",
                "Waiting for simulation",
                "--",
                "Waiting for simulation",
                "--",
                "Waiting for simulation",
                None,  # No cache
            )

        try:
            # Parse portfolio data
            portfolio = Portfolio.parse_obj(portfolio_data)

            # Determine strategy filter
            strategy_filter = None
            if selected_strategies and selected_strategies != "all":
                strategy_filter = selected_strategies

            # Use standard confidence levels (always show all percentiles)
            parsed_confidence_levels = [0.05, 0.25, 0.5, 0.75, 0.95]

            # Create Monte Carlo request
            request = MonteCarloRequest(
                strategy=strategy_filter,
                num_simulations=num_simulations,
                days_forward=int(time_horizon),
                confidence_levels=parsed_confidence_levels,
            )

            # Set random seed if requested (BEFORE running simulation!)
            if use_random_seed:
                # Use the user-provided seed value
                np.random.seed(int(seed_value) if seed_value else 42)
            else:
                # Use current time for true randomness
                np.random.seed(None)

            # Run simulation
            simulator = MonteCarloSimulator()
            use_daily_returns = bootstrap_method == "daily"
            result = simulator.run_bootstrap_simulation(portfolio, request, use_daily_returns)

            # Generate charts
            log_scale = scale_selector == "log"
            equity_curve_fig = create_equity_curve_chart(
                result, initial_capital, int(time_horizon), log_scale, show_paths
            )
            distribution_fig = create_return_distribution_chart(result)
            drawdown_fig = create_drawdown_analysis_chart(result, portfolio)

            # Calculate statistics properly

            # 1. Expected Return (annualized properly)
            # If time_horizon represents number of trades, we need to know trades per year
            # Use the user-provided trades_per_year value
            years_simulated = int(time_horizon) / trades_per_year if trades_per_year > 0 else 1

            # Annualize the expected return
            if years_simulated > 0:
                # Convert to annual return using compound formula: (1 + r)^(1/years) - 1
                expected_return_annual = (1 + result.expected_return) ** (1 / years_simulated) - 1
            else:
                expected_return_annual = result.expected_return

            expected_return_text = f"{expected_return_annual:.1%}"
            expected_return_desc = f"Annualized from {int(time_horizon)} simulated trades"

            # 2. VaR 95% (5th percentile of returns - this is correct)
            var_text = f"{result.var_95:.1%}"
            var_desc = f"95% chance return will be above this"

            # 3. Probability of Profit (final returns > 0)
            prob_profit = sum(1 for v in result.final_values if v > 0.0) / len(result.final_values)
            prob_profit_text = f"{prob_profit:.1%}"
            prob_profit_desc = f"Out of {num_simulations} simulations"

            # Debug: Log statistics for validation
            logger.info(
                f"Simulation stats - Expected: {result.expected_return:.2%}, Annual: {expected_return_annual:.2%}"
            )
            logger.info(f"VaR 95%: {result.var_95:.2%}, Prob of profit: {prob_profit:.1%}")
            logger.info(
                f"Return range: [{min(result.final_values):.2%}, {max(result.final_values):.2%}]"
            )

            # 4. Max Drawdown (95th percentile of worst drawdowns)
            # Calculate drawdowns from each simulation path
            max_drawdowns = []
            for simulation in result.simulations:
                if len(simulation) == 0:
                    continue

                # Convert returns to portfolio values
                portfolio_values = [1 + r for r in simulation]  # 1 = starting value

                # Calculate running maximum
                running_max = portfolio_values[0]
                max_drawdown = 0

                for value in portfolio_values:
                    running_max = max(running_max, value)
                    drawdown = (value - running_max) / running_max if running_max > 0 else 0
                    max_drawdown = min(max_drawdown, drawdown)

                max_drawdowns.append(abs(max_drawdown))

            # Get 95th percentile of max drawdowns (worst 5%)
            if max_drawdowns:
                max_dd = np.percentile(max_drawdowns, 95)
            else:
                max_dd = 0.0

            max_dd_text = f"{max_dd:.1%}"
            max_dd_desc = f"95th percentile worst drawdown"

            # Calculate scenario metrics
            best_case = np.percentile(result.final_values, 95)
            median_case = np.percentile(result.final_values, 50)
            worst_case = np.percentile(result.final_values, 5)

            best_case_text = f"{best_case:.1%}"
            best_case_desc = "Only 5% of simulations exceeded this"
            median_case_text = f"{median_case:.1%}"
            median_case_desc = "Half above, half below this level"
            worst_case_text = f"{worst_case:.1%}"
            worst_case_desc = "95% of simulations stayed above this"

            # Cache the simulation data for chart updates
            cache_data = {
                "result": {
                    "simulations": result.simulations,  # This is a list of cumulative return paths
                    "final_values": result.final_values,
                    "percentiles": result.percentiles,
                    "expected_return": result.expected_return,
                    "var_95": result.var_95,
                },
                "initial_capital": initial_capital,
                "time_horizon": time_horizon,
                "distribution_fig": distribution_fig,
                "drawdown_fig": drawdown_fig,
                "expected_return_text": expected_return_text,
                "expected_return_desc": expected_return_desc,
                "var_text": var_text,
                "var_desc": var_desc,
                "prob_profit_text": prob_profit_text,
                "prob_profit_desc": prob_profit_desc,
                "max_dd_text": max_dd_text,
                "max_dd_desc": max_dd_desc,
                "best_case_text": best_case_text,
                "best_case_desc": best_case_desc,
                "median_case_text": median_case_text,
                "median_case_desc": median_case_desc,
                "worst_case_text": worst_case_text,
                "worst_case_desc": worst_case_desc,
            }

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
                best_case_text,
                best_case_desc,
                median_case_text,
                median_case_desc,
                worst_case_text,
                worst_case_desc,
                cache_data,
            )

        except Exception as e:
            logger.error(f"Error running Monte Carlo simulation: {str(e)}")
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
                "Error",
                str(e),
                "Error",
                str(e),
                "Error",
                str(e),
                None,  # No cache on error
            )

    @app.callback(
        [
            Output("mc-num-simulations", "value"),
            Output("mc-time-horizon", "value"),
            Output("mc-bootstrap-method", "value"),
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
        # simulations_array is 2D: [num_simulations x time_steps]
        portfolio_values = initial_capital * (1 + simulations_array)

        # Calculate percentiles at each time step
        percentiles = {}
        if hasattr(result, "percentiles"):
            for p_name in result.percentiles.keys():
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

        # Add ALL individual paths if requested (full transparency, no sampling)
        if show_paths and len(portfolio_values) > 0:
            # Show all simulation paths with reduced opacity for clarity
            # Adjust opacity based on number of simulations to maintain visibility
            opacity = max(0.1, min(0.4, 20 / len(portfolio_values)))

            for idx in range(len(portfolio_values)):
                path_values = portfolio_values[idx]
                fig.add_trace(
                    go.Scatter(
                        x=days,
                        y=path_values,
                        mode="lines",
                        name=None,  # No names for individual paths
                        line=dict(color=f"rgba(128,128,128,{opacity})", width=0.5),
                        showlegend=False,  # Never show in legend
                        hoverinfo="skip",
                    )
                )

        # Add initial capital line
        fig.add_hline(
            y=initial_capital, line_dash="dash", line_color="red", annotation_text="Initial Capital"
        )

        fig.update_layout(
            xaxis_title="Number of Trades",
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
                    showlegend=False,
                )
            ]
        )

        # Add percentile lines as scatter traces for interactive legend
        percentile_info = {
            "p5": {"color": "red", "name": f"P5: {result.percentiles.get('p5', 0):.1%}"},
            "p50": {"color": "blue", "name": f"P50: {result.percentiles.get('p50', 0):.1%}"},
            "p95": {"color": "green", "name": f"P95: {result.percentiles.get('p95', 0):.1%}"},
        }

        # Calculate histogram to get y_max for vertical lines
        hist_counts, _ = np.histogram(result.final_values, bins=50)
        y_max = max(hist_counts) if len(hist_counts) > 0 else 1

        for p_name, info in percentile_info.items():
            if p_name in result.percentiles:
                # Add vertical line as scatter trace (interactive)
                fig.add_trace(
                    go.Scatter(
                        x=[result.percentiles[p_name], result.percentiles[p_name]],
                        y=[0, y_max],
                        mode="lines",
                        line=dict(color=info["color"], dash="dash", width=2),
                        name=info["name"],
                        showlegend=True,
                        hoverinfo="skip",
                    )
                )

        fig.update_layout(
            xaxis_title="Cumulative Return",
            yaxis_title="Frequency",
            showlegend=True,
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        )

        # Apply theme
        theme_colors = get_theme_colors({"theme": "light"})
        apply_theme_layout(fig, theme_colors)

        return fig

    except Exception as e:
        logger.error(f"Error creating return distribution chart: {str(e)}")
        return create_placeholder_histogram()


def create_drawdown_analysis_chart(result, portfolio=None):
    """Create drawdown analysis chart"""
    try:
        # Calculate maximum drawdowns from simulation paths (one per simulation)
        max_drawdowns = []
        for simulation in result.simulations:
            # simulation already contains cumulative returns
            # Convert to portfolio values (1 + return)
            portfolio_values = np.array([1 + r for r in simulation])
            running_max = np.maximum.accumulate(portfolio_values)
            drawdown = (portfolio_values - running_max) / running_max

            # Take the minimum (most negative) drawdown for this simulation
            max_dd = np.min(drawdown) if len(drawdown) > 0 else 0
            max_drawdowns.append(max_dd)

        # Use max drawdowns for percentile calculation (should all be negative or zero)
        drawdowns = max_drawdowns
        if not drawdowns or all(dd == 0 for dd in drawdowns):
            drawdowns = [-0.01, -0.005, 0]  # Fallback with some sample negative values

        drawdowns_pct = np.array(drawdowns) * 100  # Convert to percentage for consistency

        fig = go.Figure(
            data=[
                go.Histogram(
                    x=drawdowns_pct,
                    nbinsx=30,
                    marker_color="rgba(255,128,0,0.7)",
                    marker_line_color="rgba(255,128,0,1)",
                    marker_line_width=1,
                    showlegend=False,
                )
            ]
        )

        # Add percentile lines as interactive scatter traces
        percentiles = np.percentile(drawdowns, [5, 50, 95])

        # Debug: Log the actual percentile values and drawdown range
        logger.info(f"Max drawdowns range: {min(drawdowns):.4f} to {max(drawdowns):.4f}")
        logger.info(
            f"Max DD Percentiles: P5={percentiles[0]:.4f}, P50={percentiles[1]:.4f}, P95={percentiles[2]:.4f}"
        )
        logger.info(f"Number of simulations: {len(drawdowns)}")

        percentile_info = [
            {"value": percentiles[0] * 100, "color": "red", "name": f"P5: {percentiles[0]:.1%}"},
            {
                "value": percentiles[1] * 100,
                "color": "blue",
                "name": f"P50: {percentiles[1]:.1%}",
            },
            {"value": percentiles[2] * 100, "color": "green", "name": f"P95: {percentiles[2]:.1%}"},
        ]

        # Calculate histogram to get y_max for vertical lines
        # Use the same bin calculation that Plotly uses internally
        hist_counts, hist_bins = np.histogram(drawdowns_pct, bins=30)
        y_max = max(hist_counts) if len(hist_counts) > 0 else 1

        # Debug: Log histogram range and drawdown range
        logger.info(f"Histogram x-range: {min(drawdowns_pct):.2f}% to {max(drawdowns_pct):.2f}%")
        logger.info(f"Histogram bins range: {hist_bins[0]:.2f}% to {hist_bins[-1]:.2f}%")

        for info in percentile_info:
            # Debug: Log trace creation details
            logger.info(f"Adding trace: {info['name']} at x={info['value']:.2f}, y_max={y_max:.0f}")

            # Add vertical line as scatter trace (interactive)
            fig.add_trace(
                go.Scatter(
                    x=[info["value"], info["value"]],
                    y=[0, y_max],
                    mode="lines",
                    line=dict(color=info["color"], dash="dash", width=2),
                    name=info["name"],
                    showlegend=True,
                    hoverinfo="skip",
                )
            )

        fig.update_layout(
            xaxis_title="Drawdown (%)",
            yaxis_title="Frequency",
            showlegend=True,
            legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
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
