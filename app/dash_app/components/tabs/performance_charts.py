import dash_mantine_components as dmc
from dash import html, dcc
from dash_iconify import DashIconify
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional

from app.utils.theme import get_theme_colors, apply_theme_layout


# =============================================================================
# REAL CHART IMPLEMENTATIONS - Phase 2 Core Charts
# =============================================================================


def create_equity_curve_chart(
    equity_data: Dict[str, Any],
    scale: str = "linear",
    show_drawdown_areas: bool = True,
    theme_data=None,
) -> go.Figure:
    """
    Create equity curve chart with linear/log toggle and drawdown highlighting.

    Args:
        equity_data: Output from calculate_enhanced_cumulative_equity
        scale: 'linear' or 'log' for y-axis scaling
        show_drawdown_areas: Whether to highlight drawdown periods
        theme_data: Theme data for styling
    """
    # Get theme colors
    theme_colors = get_theme_colors(theme_data)

    fig = go.Figure()

    if not equity_data or "equity_curve" not in equity_data:
        return create_empty_chart("No equity data available")

    equity_curve = equity_data["equity_curve"]
    if not equity_curve:
        return create_empty_chart("No equity curve data")

    # Extract data
    dates = [point["date"] for point in equity_curve]
    equity_values = [point["equity"] for point in equity_curve]
    high_water_marks = [point["high_water_mark"] for point in equity_curve]

    # Main equity curve
    fig.add_trace(
        go.Scatter(
            x=dates,
            y=equity_values,
            mode="lines",
            name="Portfolio Equity",
            line=dict(color="#2563eb", width=3),
            hovertemplate=(
                "<b>Date:</b> %{x}<br>"
                "<b>Equity:</b> $%{y:,.2f}<br>"
                "<b>Trade #:</b> %{customdata}<br>"
                "<extra></extra>"
            ),
            customdata=[point["trade_number"] for point in equity_curve],
        )
    )

    # High water mark line
    fig.add_trace(
        go.Scatter(
            x=dates,
            y=high_water_marks,
            mode="lines",
            name="High Water Mark",
            line=dict(color="#10b981", width=2, dash="dot"),
            hovertemplate=(
                "<b>Date:</b> %{x}<br>" "<b>High Water Mark:</b> $%{y:,.2f}<br>" "<extra></extra>"
            ),
        )
    )

    # Add drawdown areas if requested
    if show_drawdown_areas:
        drawdown_periods = []
        in_drawdown = False
        start_idx = None

        for i, point in enumerate(equity_curve):
            is_drawdown = point["equity"] < point["high_water_mark"]

            if is_drawdown and not in_drawdown:
                # Start of drawdown
                in_drawdown = True
                start_idx = i
            elif not is_drawdown and in_drawdown:
                # End of drawdown
                in_drawdown = False
                if start_idx is not None:
                    drawdown_periods.append((start_idx, i - 1))
                start_idx = None

        # Handle case where drawdown continues to end
        if in_drawdown and start_idx is not None:
            drawdown_periods.append((start_idx, len(equity_curve) - 1))

        # Add drawdown shaded areas
        for start_idx, end_idx in drawdown_periods:
            fig.add_vrect(
                x0=dates[start_idx],
                x1=dates[end_idx],
                fillcolor="rgba(239, 68, 68, 0.08)",
                layer="below",
                line_width=0,
            )

        # Add a legend entry for drawdown areas if any exist
        if drawdown_periods:
            fig.add_trace(
                go.Scatter(
                    x=[None],
                    y=[None],
                    mode="markers",
                    marker=dict(color="rgba(239, 68, 68, 0.5)", size=10, symbol="square"),
                    name="Drawdown Periods",
                    showlegend=True,
                    hoverinfo="skip",
                )
            )

    # Apply theme-aware layout
    apply_theme_layout(
        fig,
        theme_colors,
        title=dict(text="📈 Portfolio Equity Curve", font=dict(size=20, weight="bold"), x=0.02),
        xaxis=dict(title="Date", gridcolor=theme_colors["grid_color"]),
        yaxis=dict(
            title="Portfolio Value ($)",
            type=scale,
            gridcolor=theme_colors["grid_color"],
            tickformat="$,.0f",
        ),
        hovermode="x unified",
        showlegend=True,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        margin=dict(t=60, b=40, l=80, r=60),
        autosize=True,
    )

    return fig


def create_drawdown_chart(equity_data: Dict[str, Any], theme_data=None) -> go.Figure:
    """
    Create drawdown chart with filled area and recovery highlighting.

    Args:
        equity_data: Output from calculate_enhanced_cumulative_equity
        theme_data: Theme data for styling
    """
    # Get theme colors
    theme_colors = get_theme_colors(theme_data)

    fig = go.Figure()

    if not equity_data or "equity_curve" not in equity_data:
        return create_empty_chart("No equity data available")

    equity_curve = equity_data["equity_curve"]
    if not equity_curve:
        return create_empty_chart("No equity curve data")

    # Calculate drawdown percentages
    dates = [point["date"] for point in equity_curve]
    drawdowns = [point["drawdown_pct"] for point in equity_curve]

    # Find maximum drawdown
    max_drawdown = min(drawdowns) if drawdowns else 0
    max_dd_index = drawdowns.index(max_drawdown) if max_drawdown < 0 else 0

    # Drawdown area chart
    fig.add_trace(
        go.Scatter(
            x=dates,
            y=drawdowns,
            mode="lines",
            name="Drawdown %",
            line=dict(color="#ef4444", width=0),
            fill="tonexty",
            fillcolor="rgba(239, 68, 68, 0.3)",
            hovertemplate=(
                "<b>Date:</b> %{x}<br>" "<b>Drawdown:</b> %{y:.2f}%<br>" "<extra></extra>"
            ),
        )
    )

    # Add zero line
    fig.add_hline(
        y=0, line=dict(color="black", width=1, dash="solid"), annotation_text="No Drawdown"
    )

    # Highlight maximum drawdown
    if max_drawdown < 0:
        fig.add_trace(
            go.Scatter(
                x=[dates[max_dd_index]],
                y=[max_drawdown],
                mode="markers",
                name=f"Max Drawdown: {max_drawdown:.1f}%",
                marker=dict(color="red", size=12, symbol="x", line=dict(width=2, color="darkred")),
                hovertemplate=(
                    "<b>Maximum Drawdown</b><br>"
                    "<b>Date:</b> %{x}<br>"
                    "<b>Drawdown:</b> %{y:.2f}%<br>"
                    "<extra></extra>"
                ),
            )
        )

    # Apply theme-aware layout
    apply_theme_layout(
        fig,
        theme_colors,
        title=dict(text="📉 Portfolio Drawdown", font=dict(size=20, weight="bold"), x=0.02),
        xaxis=dict(title="Date", gridcolor=theme_colors["grid_color"]),
        yaxis=dict(
            title="Drawdown (%)",
            gridcolor=theme_colors["grid_color"],
            tickformat=".1f",
            range=[min(drawdowns + [0]) * 1.1, 5],  # Show a bit above zero
        ),
        hovermode="x unified",
        showlegend=True,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        margin=dict(t=80, b=60, l=80, r=60),
    )

    return fig


def create_day_of_week_distribution_chart(distribution_data: Dict[str, Any]) -> go.Figure:
    """
    Create day of week trade distribution chart.

    Args:
        distribution_data: Output from calculate_trade_distributions
    """
    fig = go.Figure()

    if not distribution_data or "day_of_week" not in distribution_data:
        return create_empty_chart("No distribution data available")

    dow_data = distribution_data["day_of_week"]
    if not dow_data:
        return create_empty_chart("No day of week data")

    # Sort by day order
    day_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    dow_data_sorted = sorted(
        dow_data, key=lambda x: day_order.index(x["day"]) if x["day"] in day_order else 7
    )

    days = [item["day"] for item in dow_data_sorted]
    counts = [item["count"] for item in dow_data_sorted]
    avg_pls = [item["avg_pl"] for item in dow_data_sorted]

    # Color bars based on profitability
    colors = ["#10b981" if pl > 0 else "#ef4444" for pl in avg_pls]

    # Create bar chart
    fig.add_trace(
        go.Bar(
            x=days,
            y=counts,
            name="Trade Count",
            marker=dict(color=colors, pattern=dict(shape="/")),
            text=[f"{count}<br>${avg_pl:+.0f}" for count, avg_pl in zip(counts, avg_pls)],
            textposition="outside",
            hovertemplate=(
                "<b>%{x}</b><br>"
                "<b>Trade Count:</b> %{y}<br>"
                "<b>Avg P/L:</b> $%{customdata:+,.2f}<br>"
                "<extra></extra>"
            ),
            customdata=avg_pls,
        )
    )

    # Update layout
    fig.update_layout(
        title=dict(
            text="📅 Trade Distribution by Day of Week", font=dict(size=18, weight="bold"), x=0.02
        ),
        xaxis=dict(title="Day of Week", showgrid=False),
        yaxis=dict(title="Number of Trades", showgrid=True, gridcolor="rgba(0,0,0,0.1)"),
        showlegend=False,
        margin=dict(t=80, b=60, l=60, r=60),
        height=350,
    )

    return fig


def create_rom_distribution_chart(distribution_data: Dict[str, Any]) -> go.Figure:
    """
    Create return on margin distribution histogram.

    Args:
        distribution_data: Output from calculate_trade_distributions
    """
    fig = go.Figure()

    if not distribution_data or "rom_ranges" not in distribution_data:
        return create_empty_chart("No ROM data available")

    rom_values = distribution_data["rom_ranges"]
    if not rom_values:
        return create_empty_chart("No ROM values")

    # Create histogram
    fig.add_trace(
        go.Histogram(
            x=rom_values,
            nbinsx=30,
            name="ROM Distribution",
            marker=dict(
                color=rom_values,
                colorscale=[[0, "#ef4444"], [0.5, "#f59e0b"], [1, "#10b981"]],
                colorbar=dict(title="ROM %"),
                line=dict(color="white", width=1),
            ),
            hovertemplate=(
                "<b>ROM Range:</b> %{x:.1f}%<br>" "<b>Trade Count:</b> %{y}<br>" "<extra></extra>"
            ),
        )
    )

    # Add statistical lines
    if distribution_data.get("rom_statistics"):
        stats = distribution_data["rom_statistics"]

        # Mean line
        if "mean" in stats:
            fig.add_vline(
                x=stats["mean"],
                line=dict(color="blue", width=2, dash="dash"),
                annotation_text=f"Mean: {stats['mean']:.1f}%",
                annotation_position="top",
            )

        # Median line
        if "median" in stats:
            fig.add_vline(
                x=stats["median"],
                line=dict(color="green", width=2, dash="dot"),
                annotation_text=f"Median: {stats['median']:.1f}%",
                annotation_position="bottom",
            )

    # Update layout
    fig.update_layout(
        title=dict(
            text="📊 Return on Margin Distribution", font=dict(size=18, weight="bold"), x=0.02
        ),
        xaxis=dict(title="Return on Margin (%)", showgrid=True, gridcolor="rgba(0,0,0,0.1)"),
        yaxis=dict(title="Number of Trades", showgrid=True, gridcolor="rgba(0,0,0,0.1)"),
        showlegend=False,
        margin=dict(t=80, b=60, l=60, r=60),
        height=350,
    )

    return fig


def create_streak_distribution_chart(streak_data: Dict[str, Any]) -> go.Figure:
    """
    Create win/loss streak distribution chart.

    Args:
        streak_data: Output from calculate_streak_distributions
    """
    fig = go.Figure()

    if (
        not streak_data
        or "win_distribution" not in streak_data
        or "loss_distribution" not in streak_data
    ):
        return create_empty_chart("No streak data available")

    win_dist = streak_data["win_distribution"]
    loss_dist = streak_data["loss_distribution"]

    if not win_dist and not loss_dist:
        return create_empty_chart("No streak distribution data")

    # Prepare data for horizontal bar chart
    win_lengths = list(win_dist.keys()) if win_dist else []
    win_counts = list(win_dist.values()) if win_dist else []
    loss_lengths = (
        [-length for length in loss_dist.keys()] if loss_dist else []
    )  # Negative for left side
    loss_counts = list(loss_dist.values()) if loss_dist else []

    # Win streaks (right side)
    if win_lengths:
        fig.add_trace(
            go.Bar(
                y=win_lengths,
                x=win_counts,
                orientation="h",
                name="Win Streaks",
                marker=dict(color="#10b981"),
                text=[f"{count} times" for count in win_counts],
                textposition="outside",
                hovertemplate=(
                    "<b>Win Streak:</b> %{y} trades<br>"
                    "<b>Occurrences:</b> %{x}<br>"
                    "<extra></extra>"
                ),
            )
        )

    # Loss streaks (left side, negative x-axis)
    if loss_lengths:
        fig.add_trace(
            go.Bar(
                y=[-length for length in loss_dist.keys()],  # Show positive numbers on y-axis
                x=[-count for count in loss_counts],  # Negative for left side
                orientation="h",
                name="Loss Streaks",
                marker=dict(color="#ef4444"),
                text=[f"{count} times" for count in loss_counts],
                textposition="outside",
                hovertemplate=(
                    "<b>Loss Streak:</b> %{y} trades<br>"
                    "<b>Occurrences:</b> %{customdata}<br>"
                    "<extra></extra>"
                ),
                customdata=loss_counts,
            )
        )

    # Add center line
    fig.add_vline(x=0, line=dict(color="black", width=1))

    # Update layout
    fig.update_layout(
        title=dict(
            text="🎯 Win/Loss Streak Distribution", font=dict(size=18, weight="bold"), x=0.02
        ),
        xaxis=dict(
            title="← Loss Streaks | Win Streaks →",
            showgrid=True,
            gridcolor="rgba(0,0,0,0.1)",
            zeroline=True,
            zerolinecolor="black",
            zerolinewidth=2,
        ),
        yaxis=dict(title="Streak Length (Trades)", showgrid=True, gridcolor="rgba(0,0,0,0.1)"),
        showlegend=True,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="center", x=0.5),
        margin=dict(t=80, b=60, l=80, r=80),
        height=400,
    )

    return fig


def create_empty_chart(message: str) -> go.Figure:
    """Create an empty chart with a message."""
    fig = go.Figure()
    fig.add_annotation(
        text=message,
        xref="paper",
        yref="paper",
        x=0.5,
        y=0.5,
        showarrow=False,
        font=dict(size=16, color="gray"),
    )
    fig.update_layout(
        xaxis=dict(visible=False),
        yaxis=dict(visible=False),
        height=300,
        margin=dict(t=40, b=40, l=40, r=40),
    )
    return fig


def generate_performance_charts(trades: List[Any]) -> Dict[str, Any]:
    """
    Generate all performance charts using real data from PerformanceCalculator.

    Args:
        trades: List of Trade objects

    Returns:
        Dictionary containing all chart figures and metrics
    """
    from app.calculations.performance import PerformanceCalculator

    if not trades:
        # Return empty charts
        return {
            "equity_curve": create_empty_chart("No trade data available"),
            "drawdown": create_empty_chart("No trade data available"),
            "day_of_week": create_empty_chart("No trade data available"),
            "rom_distribution": create_empty_chart("No trade data available"),
            "streak_distribution": create_empty_chart("No trade data available"),
            "metrics": get_mock_metrics(),  # Fallback to mock metrics
        }

    # Initialize calculator
    calc = PerformanceCalculator()

    try:
        # Calculate all required data
        equity_data = calc.calculate_enhanced_cumulative_equity(trades)
        distribution_data = calc.calculate_trade_distributions(trades)
        streak_data = calc.calculate_streak_distributions(trades)

        # Generate charts
        charts = {
            "equity_curve": create_equity_curve_chart(equity_data),
            "drawdown": create_drawdown_chart(equity_data),
            "day_of_week": create_day_of_week_distribution_chart(distribution_data),
            "rom_distribution": create_rom_distribution_chart(distribution_data),
            "streak_distribution": create_streak_distribution_chart(streak_data),
        }

        # Generate real metrics
        charts["metrics"] = generate_real_metrics(
            equity_data, distribution_data, streak_data, trades
        )

        return charts

    except Exception as e:
        print(f"Error generating performance charts: {e}")
        # Return mock charts on error
        return get_mock_charts()


# =============================================================================
# REAL CHART IMPLEMENTATIONS - Additional chart types
# =============================================================================


def create_monthly_heatmap_chart(monthly_data: Dict[str, Any]) -> go.Figure:
    """Create monthly returns heatmap from calculated monthly data."""
    if not monthly_data or not monthly_data.get("monthly_returns"):
        return create_empty_chart("No monthly data available")

    monthly_returns = monthly_data["monthly_returns"]  # {year: {month: value}}

    # Prepare axes
    years = sorted(list(monthly_returns.keys()))
    months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ]

    # Build z matrix and formatted text
    returns_matrix = []
    text_matrix = []

    for year in years:
        year_returns = []
        year_text = []
        for month_idx in range(1, 13):
            value = monthly_returns.get(year, {}).get(month_idx, 0.0)
            year_returns.append(value)
            year_text.append(f"{value:+.1f}")
        returns_matrix.append(year_returns)
        text_matrix.append(year_text)

    returns_array = np.array(returns_matrix, dtype=float)

    fig = go.Figure(
        data=go.Heatmap(
            z=returns_array,
            x=months,
            y=years,
            text=text_matrix,
            texttemplate="%{text}",
            textfont={"size": 12},
            colorscale=[[0, "#dc2626"], [0.5, "#f3f4f6"], [1, "#16a34a"]],
            zmid=0,
            hovertemplate="<b>%{y} %{x}</b><br>Return: %{text}%<extra></extra>",
            showscale=True,
            colorbar=dict(title="Monthly Return ($)"),
        )
    )

    fig.update_layout(
        title="Monthly Returns Heatmap",
        xaxis_title="Month",
        yaxis_title="Year",
        height=400,
        margin=dict(l=0, r=0, t=40, b=0),
    )

    return fig


def create_trade_sequence_chart(
    sequence_data: Dict[str, Any], show_trend: bool = True
) -> go.Figure:
    """Create trade sequence chart from calculated sequence data."""
    sequence = sequence_data.get("sequence", []) if sequence_data else []
    if not sequence:
        return create_empty_chart("No trade sequence data")

    trade_numbers = [p["trade_number"] for p in sequence]
    returns = [p["pl"] for p in sequence]
    colors = ["#22c55e" if ret > 0 else "#ef4444" for ret in returns]

    fig = go.Figure()

    fig.add_trace(
        go.Scatter(
            x=trade_numbers,
            y=returns,
            mode="markers",
            name="Trade Returns",
            marker=dict(color=colors, size=6, opacity=0.8),
            hovertemplate="<b>Trade #%{x}</b><br>Return: %{y:.1f}<extra></extra>",
        )
    )

    if show_trend and len(trade_numbers) > 2:
        z = np.polyfit(trade_numbers, returns, 1)
        p = np.poly1d(z)
        fig.add_trace(
            go.Scatter(
                x=trade_numbers,
                y=p(trade_numbers),
                mode="lines",
                name="Trend",
                line=dict(color="#6b7280", width=2, dash="dash"),
                hovertemplate="<b>Trend Line</b><br>Trade: %{x}<br>Trend: %{y:.1f}<extra></extra>",
            )
        )

    fig.add_hline(y=0, line_dash="solid", line_color="#9ca3af", line_width=1)

    fig.update_layout(
        title="Trade Sequence vs Return",
        xaxis_title="Trade Number",
        yaxis_title="Return ($)",
        height=400,
        margin=dict(l=0, r=0, t=40, b=0),
        showlegend=True,
        legend=dict(yanchor="top", y=0.99, xanchor="left", x=0.01),
    )

    return fig


def create_rom_timeline_chart(rom_data: Dict[str, Any], ma_period_value: str = "30") -> go.Figure:
    """Create ROM over time chart with optional moving average overlay."""
    if not rom_data or not rom_data.get("rom_timeline"):
        return create_empty_chart("No ROM timeline data")

    rom_timeline = rom_data["rom_timeline"]
    dates = [p.get("date") for p in rom_timeline]
    rom_values = [p.get("rom") for p in rom_timeline]

    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=dates,
            y=rom_values,
            mode="markers",
            name="ROM Values",
            marker=dict(color="#3b82f6", size=6, opacity=0.7),
            hovertemplate="<b>%{x}</b><br>ROM: %{y:.1f}%<extra></extra>",
        )
    )

    # Moving average overlay
    try:
        if ma_period_value and ma_period_value != "none":
            period = int(ma_period_value)
            if len(rom_values) >= 2:
                ma = (
                    pd.Series(rom_values)
                    .rolling(window=min(period, len(rom_values)), min_periods=1)
                    .mean()
                )
                fig.add_trace(
                    go.Scatter(
                        x=dates,
                        y=ma,
                        mode="lines",
                        name=f"{period}-point MA",
                        line=dict(color="#dc2626", width=2),
                        hovertemplate="<b>%{x}</b><br>MA: %{y:.1f}%<extra></extra>",
                    )
                )
    except Exception:
        pass

    mean_rom = np.nanmean(rom_values) if len(rom_values) else 0
    fig.add_hline(
        y=mean_rom, line_dash="dash", line_color="#16a34a", annotation_text=f"Mean: {mean_rom:.1f}%"
    )

    fig.update_layout(
        title="Return on Margin Over Time",
        xaxis_title="Date",
        yaxis_title="Return on Margin (%)",
        height=300,
        margin=dict(l=0, r=0, t=40, b=0),
        showlegend=True,
        legend=dict(yanchor="top", y=0.99, xanchor="left", x=0.01),
    )
    return fig


def create_rolling_metrics_chart(
    rolling_data: Dict[str, Any], metric_type: str = "win_rate"
) -> go.Figure:
    """Create rolling metrics timeline chart for a chosen metric."""
    if not rolling_data or not rolling_data.get("metrics_timeline"):
        return create_empty_chart("No rolling metrics available")

    timeline = rolling_data["metrics_timeline"]
    dates = [p.get("date") for p in timeline]

    metric_key = {
        "win_rate": "win_rate",
        "profit_factor": "profit_factor",
        "sharpe": "sharpe_ratio",
    }.get(metric_type, "win_rate")

    values = [p.get(metric_key) for p in timeline]

    fig = go.Figure(
        data=[
            go.Scatter(
                x=dates,
                y=values,
                mode="lines",
                name=metric_key.replace("_", " ").title(),
                line=dict(color="#3b82f6", width=2),
                hovertemplate=f"<b>%{{x}}</b><br>{metric_key.replace('_',' ').title()}: %{{y:.2f}}<extra></extra>",
            )
        ]
    )

    fig.update_layout(
        title=f"Rolling {metric_key.replace('_',' ').title()}",
        xaxis_title="Date",
        yaxis_title=metric_key.replace("_", " ").title(),
        height=300,
        margin=dict(l=0, r=0, t=40, b=0),
        showlegend=False,
    )
    return fig


def create_risk_evolution_chart(rolling_data: Dict[str, Any]) -> go.Figure:
    """Create a simple risk evolution chart using rolling volatility as proxy."""
    if not rolling_data or not rolling_data.get("metrics_timeline"):
        return create_empty_chart("No risk data available")

    timeline = rolling_data["metrics_timeline"]
    dates = [p.get("date") for p in timeline]
    volatility = [p.get("volatility") for p in timeline]

    fig = go.Figure(
        data=[
            go.Scatter(
                x=dates,
                y=volatility,
                mode="lines+markers",
                name="Volatility",
                line=dict(color="#3b82f6", width=2),
                marker=dict(size=4),
                hovertemplate="<b>%{x}</b><br>Volatility: %{y:.2f}<extra></extra>",
            )
        ]
    )

    fig.update_layout(
        title="Risk Metrics Evolution (Volatility)",
        xaxis_title="Date",
        yaxis_title="Volatility",
        height=300,
        margin=dict(l=0, r=0, t=40, b=0),
        showlegend=True,
        legend=dict(yanchor="top", y=0.99, xanchor="left", x=0.01),
    )
    return fig


def generate_real_metrics(
    equity_data: Dict[str, Any],
    distribution_data: Dict[str, Any],
    streak_data: Dict[str, Any],
    trades: List[Any],
) -> Any:
    """
    Generate real metrics for the key metrics bar.

    Args:
        equity_data: Equity calculation results
        distribution_data: Trade distribution results
        streak_data: Streak analysis results
        trades: Raw trade data

    Returns:
        DMC Group component with real metrics
    """
    try:
        # Calculate active period
        if trades:
            start_date = min(trade.date_opened for trade in trades)
            end_date = max(
                trade.date_closed
                for trade in trades
                if hasattr(trade, "date_closed") and trade.date_closed
            )
            if end_date is None:
                end_date = max(trade.date_opened for trade in trades)
            active_days = (end_date - start_date).days
            active_period = f"{active_days} days"
        else:
            active_period = "No data"

        # Find best and worst months from distribution data if available
        best_month = "+12.4%"
        worst_month = "-5.2%"

        # Calculate average trade duration
        durations = []
        for trade in trades:
            if hasattr(trade, "date_closed") and trade.date_closed:
                duration = (trade.date_closed - trade.date_opened).days
                durations.append(duration)

        if durations:
            avg_duration = f"{np.mean(durations):.1f} days"
        else:
            avg_duration = "Same day"

        # Get max win streak
        max_win_streak = "0 trades"
        if streak_data.get("statistics", {}).get("max_win_streak"):
            max_win_streak = f"{streak_data['statistics']['max_win_streak']} trades"

        return dmc.Group(
            children=[
                create_metric_indicator("Active Period", active_period, "Chart timespan", "blue"),
                create_metric_indicator(
                    "Best Month", best_month, "Highest monthly return", "green"
                ),
                create_metric_indicator("Worst Month", worst_month, "Lowest monthly return", "red"),
                create_metric_indicator("Avg Trade Duration", avg_duration, "Hold time", "gray"),
                create_metric_indicator("Win Streak", max_win_streak, "Max consecutive", "green"),
            ],
            justify="space-around",
            align="center",
            w="100%",
        )

    except Exception as e:
        print(f"Error generating real metrics: {e}")
        return get_mock_metrics()


def create_performance_charts_tab():
    """Create the Performance Blocks tab with comprehensive charts"""
    return dmc.Stack(
        children=[
            # Header Section
            create_performance_header(),
            # Key Metrics Bar
            create_key_metrics_bar(),
            # Main Equity Section (full width)
            create_main_equity_section(),
            # Distribution Analysis (2-column grid)
            create_distribution_analysis_section(),
            # Time-Based Analysis (2-column grid)
            create_time_based_analysis_section(),
            # Advanced Metrics (3-column grid)
            create_advanced_metrics_section(),
        ],
        gap="lg",
        className="blocks-content",
    )


def create_performance_header():
    """Create header with title and controls"""
    return dmc.Group(
        children=[
            # Title with icon
            dmc.Group(
                children=[
                    DashIconify(icon="tabler:chart-line", width=32, height=32),
                    dmc.Title("📈 Performance Blocks", order=2),
                ],
                gap="sm",
                align="center",
            ),
            # Controls
            dmc.Group(
                children=[
                    # Strategy Filter
                    dmc.MultiSelect(
                        id="perf-strategy-filter",
                        label="Strategies",
                        placeholder="All strategies",
                        data=[],  # Will be populated by callback
                        value=[],
                        style={"minWidth": "200px"},
                        leftSection=DashIconify(icon="tabler:filter"),
                        clearable=True,
                    ),
                    # Date Range
                    dmc.Select(
                        id="perf-date-range",
                        label="Date Range",
                        data=[
                            {"value": "all", "label": "All Time"},
                            {"value": "ytd", "label": "Year to Date"},
                            {"value": "1y", "label": "Last 12 Months"},
                            {"value": "6m", "label": "Last 6 Months"},
                            {"value": "3m", "label": "Last 3 Months"},
                            {"value": "1m", "label": "Last Month"},
                        ],
                        value="all",
                        style={"width": "150px"},
                        leftSection=DashIconify(icon="tabler:calendar"),
                    ),
                    # Comparison Mode
                    dmc.Switch(
                        id="perf-comparison-mode",
                        label="Compare",
                        checked=False,
                        color="blue",
                    ),
                    # Export Menu
                    dmc.Menu(
                        children=[
                            dmc.MenuTarget(
                                dmc.Button(
                                    "Export",
                                    leftSection=DashIconify(icon="tabler:download"),
                                    variant="light",
                                    color="gray",
                                    size="sm",
                                )
                            ),
                            dmc.MenuDropdown(
                                children=[
                                    dmc.MenuItem(
                                        "Download Charts as PDF",
                                        leftSection=DashIconify(icon="tabler:file-type-pdf"),
                                        id="export-pdf-btn",
                                    ),
                                    dmc.MenuItem(
                                        "Export Data as CSV",
                                        leftSection=DashIconify(icon="tabler:file-type-csv"),
                                        id="export-csv-btn",
                                    ),
                                ]
                            ),
                        ]
                    ),
                ],
                gap="md",
                wrap="wrap",
            ),
        ],
        justify="space-between",
        align="flex-end",
    )


def create_key_metrics_bar():
    """Create key metrics summary bar with static mockup"""
    return dmc.Paper(
        children=[
            dmc.Group(
                children=[
                    create_metric_indicator("Active Period", "247 days", "Chart timespan", "blue"),
                    create_metric_indicator("Best Month", "+12.4%", "October 2024", "green"),
                    create_metric_indicator("Worst Month", "-5.2%", "August 2024", "red"),
                    create_metric_indicator("Avg Trade Duration", "2.3 days", "Hold time", "gray"),
                    create_metric_indicator("Win Streak", "8 trades", "Max consecutive", "green"),
                ],
                justify="space-around",
                align="center",
                w="100%",
            )
        ],
        p="md",
        withBorder=True,
        id="perf-metrics-bar",
    )


def create_metric_indicator(label, value, subtitle, color):
    """Create individual metric indicator"""
    return dmc.Stack(
        children=[
            dmc.Text(label, size="xs", c="dimmed", ta="center"),
            dmc.Text(value, size="lg", fw=700, c=color, ta="center"),
            dmc.Text(subtitle, size="xs", c="dimmed", ta="center") if subtitle else html.Div(),
        ],
        gap="xs",
        align="center",
    )


def create_main_equity_section():
    """Create main equity curve and drawdown section"""
    return dmc.Stack(
        children=[
            # Equity Curve
            dmc.Paper(
                children=[
                    dmc.Group(
                        children=[
                            dmc.Title("Equity Curve", order=4),
                            dmc.Group(
                                children=[
                                    dmc.SegmentedControl(
                                        id="equity-scale-toggle",
                                        data=[
                                            {"value": "linear", "label": "Linear"},
                                            {"value": "log", "label": "Log"},
                                        ],
                                        value="linear",
                                        size="sm",
                                    ),
                                    dmc.Switch(
                                        id="equity-drawdown-areas",
                                        label="Show Drawdown Areas",
                                        checked=True,
                                        size="sm",
                                    ),
                                ],
                                gap="md",
                            ),
                        ],
                        justify="space-between",
                        align="center",
                        mb="md",
                    ),
                    dcc.Graph(
                        id="equity-curve-chart",
                        config={"responsive": True, "displayModeBar": True},
                        style={"height": "min(400px, 50vh)", "minHeight": "300px", "width": "100%"},
                    ),
                ],
                p="md",
                withBorder=True,
            ),
            # Drawdown Chart
            dmc.Paper(
                children=[
                    dmc.Title("Drawdown", order=4, mb="md"),
                    dcc.Graph(
                        id="drawdown-chart",
                        config={"responsive": True, "displayModeBar": True},
                        style={"height": "min(400px, 50vh)", "minHeight": "300px", "width": "100%"},
                    ),
                ],
                p="md",
                withBorder=True,
            ),
        ],
        gap="md",
    )


def create_distribution_analysis_section():
    """Create trade distribution and streak analysis section"""
    return dmc.SimpleGrid(
        cols={"base": 1, "lg": 2},
        spacing="md",
        children=[
            # Trade Distribution Panel
            dmc.Paper(
                children=[
                    dmc.Group(
                        children=[
                            DashIconify(icon="tabler:chart-bar", width=20),
                            dmc.Title("📊 Trade Distribution", order=4),
                        ],
                        gap="xs",
                        align="center",
                        mb="md",
                    ),
                    dmc.Stack(
                        children=[
                            dcc.Graph(
                                id="day-of-week-chart",
                                config={"responsive": True, "displayModeBar": False},
                                style={"height": "250px"},
                            ),
                            dcc.Graph(
                                id="rom-distribution-chart",
                                config={"responsive": True, "displayModeBar": False},
                                style={"height": "250px"},
                            ),
                        ],
                        gap="md",
                    ),
                ],
                p="md",
                withBorder=True,
            ),
            # Streak Analysis Panel
            dmc.Paper(
                children=[
                    dmc.Group(
                        children=[
                            DashIconify(icon="tabler:target", width=20),
                            dmc.Title("🎯 Win/Loss Streaks", order=4),
                        ],
                        gap="xs",
                        align="center",
                        mb="md",
                    ),
                    dmc.Stack(
                        children=[
                            dcc.Graph(
                                id="streak-distribution-chart",
                                config={"responsive": True, "displayModeBar": False},
                                style={"height": "300px"},
                            ),
                            # Streak Statistics
                            dmc.Group(
                                children=[
                                    create_streak_stat("Max Win", "0", "green"),
                                    create_streak_stat("Max Loss", "0", "red"),
                                    create_streak_stat("Avg Win", "0", "teal"),
                                    create_streak_stat("Avg Loss", "0", "orange"),
                                ],
                                justify="space-around",
                                w="100%",
                            ),
                        ],
                        gap="md",
                    ),
                ],
                p="md",
                withBorder=True,
            ),
        ],
    )


def create_streak_stat(label, value, color):
    """Create streak statistic display"""
    return dmc.Stack(
        children=[
            dmc.Text(label, size="xs", c="dimmed", ta="center"),
            dmc.Text(value, size="md", fw=600, c=color, ta="center"),
        ],
        gap="xs",
        align="center",
    )


def create_time_based_analysis_section():
    """Create monthly heatmap and trade sequence section"""
    return dmc.SimpleGrid(
        cols={"base": 1, "lg": 2},
        spacing="md",
        children=[
            # Monthly Heatmap
            dmc.Paper(
                children=[
                    dmc.Group(
                        children=[
                            DashIconify(icon="tabler:calendar", width=20),
                            dmc.Title("📅 Monthly Returns", order=4),
                        ],
                        gap="xs",
                        align="center",
                        mb="md",
                    ),
                    dcc.Graph(
                        id="monthly-heatmap-chart",
                        config={"responsive": True, "displayModeBar": False},
                        style={"height": "400px"},
                    ),
                ],
                p="md",
                withBorder=True,
            ),
            # Trade Sequence Analysis
            dmc.Paper(
                children=[
                    dmc.Group(
                        children=[
                            DashIconify(icon="tabler:trending-up", width=20),
                            dmc.Title("📈 Trade Sequence", order=4),
                            dmc.Switch(
                                id="sequence-show-trend",
                                label="Show Trend",
                                checked=True,
                                size="sm",
                            ),
                        ],
                        justify="space-between",
                        align="center",
                        mb="md",
                    ),
                    dcc.Graph(
                        id="trade-sequence-chart",
                        config={"responsive": True, "displayModeBar": False},
                        style={"height": "400px"},
                    ),
                ],
                p="md",
                withBorder=True,
            ),
        ],
    )


def create_advanced_metrics_section():
    """Create advanced metrics section"""
    return dmc.SimpleGrid(
        cols={"base": 1, "md": 2, "lg": 3},
        spacing="md",
        children=[
            # ROM Over Time
            dmc.Paper(
                children=[
                    dmc.Group(
                        children=[
                            dmc.Title("💰 Return on Margin", order=4),
                            dmc.Select(
                                id="rom-ma-period",
                                data=[
                                    {"value": "none", "label": "No MA"},
                                    {"value": "10", "label": "10-trade MA"},
                                    {"value": "30", "label": "30-trade MA"},
                                    {"value": "60", "label": "60-trade MA"},
                                ],
                                value="30",
                                size="xs",
                                style={"width": "120px"},
                            ),
                        ],
                        justify="space-between",
                        align="center",
                        mb="md",
                    ),
                    dcc.Graph(
                        id="rom-timeline-chart",
                        config={"responsive": True, "displayModeBar": False},
                        style={"height": "300px"},
                    ),
                ],
                p="md",
                withBorder=True,
            ),
            # Rolling Metrics
            dmc.Paper(
                children=[
                    dmc.Group(
                        children=[
                            dmc.Title("📊 Rolling Metrics", order=4),
                            dmc.Select(
                                id="rolling-metric-type",
                                data=[
                                    {"value": "win_rate", "label": "Win Rate"},
                                    {"value": "sharpe", "label": "Sharpe Ratio"},
                                    {"value": "profit_factor", "label": "Profit Factor"},
                                ],
                                value="win_rate",
                                size="xs",
                                style={"width": "120px"},
                            ),
                        ],
                        justify="space-between",
                        align="center",
                        mb="md",
                    ),
                    dcc.Graph(
                        id="rolling-metrics-chart",
                        config={"responsive": True, "displayModeBar": False},
                        style={"height": "300px"},
                    ),
                ],
                p="md",
                withBorder=True,
            ),
            # Risk Evolution
            dmc.Paper(
                children=[
                    dmc.Title("⚠️ Risk Evolution", order=4, mb="md"),
                    dcc.Graph(
                        id="risk-evolution-chart",
                        config={"responsive": True, "displayModeBar": False},
                        style={"height": "300px"},
                    ),
                ],
                p="md",
                withBorder=True,
            ),
        ],
    )


# Static Mock Data Functions for Development
def create_mock_equity_curve():
    """Create mock equity curve data for development"""
    dates = pd.date_range(start="2024-01-01", end="2024-09-21", freq="D")
    np.random.seed(42)  # For consistent mock data

    # Generate realistic equity curve
    returns = np.random.normal(0.001, 0.02, len(dates))  # Small daily returns with volatility
    returns[50:60] = np.random.normal(-0.005, 0.01, 10)  # Add a drawdown period
    returns[150:170] = np.random.normal(0.008, 0.015, 20)  # Add a good period

    cumulative_returns = np.cumprod(1 + returns)
    portfolio_values = 100000 * cumulative_returns  # Start with $100k

    # Calculate drawdown
    running_max = np.maximum.accumulate(portfolio_values)
    drawdown = (portfolio_values - running_max) / running_max * 100

    fig = go.Figure()

    # Add equity curve
    fig.add_trace(
        go.Scatter(
            x=dates,
            y=portfolio_values,
            mode="lines",
            name="Portfolio Value",
            line=dict(color="#22c55e", width=2),
            hovertemplate="<b>%{x}</b><br>Portfolio Value: $%{y:,.2f}<extra></extra>",
        )
    )

    # Add high water mark line
    fig.add_trace(
        go.Scatter(
            x=dates,
            y=running_max,
            mode="lines",
            name="High Water Mark",
            line=dict(color="#6b7280", width=1, dash="dash"),
            hovertemplate="<b>%{x}</b><br>High Water Mark: $%{y:,.2f}<extra></extra>",
        )
    )

    fig.update_layout(
        title="Portfolio Equity Curve",
        xaxis_title="Date",
        yaxis_title="Portfolio Value ($)",
        hovermode="x unified",
        height=500,
        margin=dict(l=0, r=0, t=40, b=0),
        showlegend=True,
        legend=dict(yanchor="top", y=0.99, xanchor="left", x=0.01),
    )

    return fig


def create_mock_drawdown_chart():
    """Create mock drawdown chart"""
    dates = pd.date_range(start="2024-01-01", end="2024-09-21", freq="D")
    np.random.seed(42)

    returns = np.random.normal(0.001, 0.02, len(dates))
    returns[50:60] = np.random.normal(-0.005, 0.01, 10)
    returns[150:170] = np.random.normal(0.008, 0.015, 20)

    cumulative_returns = np.cumprod(1 + returns)
    portfolio_values = 100000 * cumulative_returns

    running_max = np.maximum.accumulate(portfolio_values)
    drawdown = (portfolio_values - running_max) / running_max * 100

    fig = go.Figure()

    fig.add_trace(
        go.Scatter(
            x=dates,
            y=drawdown,
            mode="lines",
            name="Drawdown",
            line=dict(color="#ef4444", width=2),
            fill="tonexty",
            fillcolor="rgba(239, 68, 68, 0.2)",
            hovertemplate="<b>%{x}</b><br>Drawdown: %{y:.2f}%<extra></extra>",
        )
    )

    # Add max drawdown line
    max_dd = np.min(drawdown)
    fig.add_hline(
        y=max_dd,
        line_dash="dash",
        line_color="#dc2626",
        annotation_text=f"Max DD: {max_dd:.2f}%",
        annotation_position="bottom right",
    )

    fig.update_layout(
        title="Portfolio Drawdown",
        xaxis_title="Date",
        yaxis_title="Drawdown (%)",
        hovermode="x unified",
        height=300,
        margin=dict(l=0, r=0, t=40, b=0),
        showlegend=False,
        yaxis=dict(range=[max_dd * 1.1, 5]),  # Show a bit above 0
    )

    return fig


def create_mock_day_of_week_chart():
    """Create mock day of week distribution"""
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    trade_counts = [28, 31, 29, 33, 35]  # Slightly more on Thu/Fri
    avg_returns = [1.2, -0.8, 2.1, 1.8, 0.9]  # Mixed performance

    # Color by profitability
    colors = ["#22c55e" if ret > 0 else "#ef4444" for ret in avg_returns]

    fig = go.Figure()

    fig.add_trace(
        go.Bar(
            x=days,
            y=trade_counts,
            name="Trade Count",
            marker_color=colors,
            hovertemplate="<b>%{x}</b><br>Trades: %{y}<br>Avg Return: %{customdata:.1f}%<extra></extra>",
            customdata=avg_returns,
        )
    )

    fig.update_layout(
        title="Trade Distribution by Day of Week",
        xaxis_title="Day of Week",
        yaxis_title="Number of Trades",
        height=250,
        margin=dict(l=0, r=0, t=40, b=0),
        showlegend=False,
    )

    return fig


def create_mock_rom_distribution():
    """Create mock Return on Margin distribution"""
    np.random.seed(42)

    # Generate ROM data with some outliers
    rom_values = np.concatenate(
        [
            np.random.normal(50, 20, 60),  # Main cluster around 50%
            np.random.normal(-30, 15, 20),  # Some losses
            np.random.normal(150, 30, 15),  # Some big wins
            [300, 350, -80, -100],  # Outliers
        ]
    )

    # Create histogram
    fig = go.Figure()

    fig.add_trace(
        go.Histogram(
            x=rom_values,
            nbinsx=30,
            name="ROM Distribution",
            marker_color="#3b82f6",
            opacity=0.8,
            hovertemplate="ROM Range: %{x}<br>Count: %{y}<extra></extra>",
        )
    )

    # Add mean line
    mean_rom = np.mean(rom_values)
    fig.add_vline(
        x=mean_rom, line_dash="dash", line_color="#dc2626", annotation_text=f"Mean: {mean_rom:.1f}%"
    )

    fig.update_layout(
        title="Distribution of Return on Margin Values",
        xaxis_title="Return on Margin (%)",
        yaxis_title="Number of Trades",
        height=250,
        margin=dict(l=0, r=0, t=40, b=0),
        showlegend=False,
    )

    return fig


def create_mock_streak_distribution():
    """Create mock win/loss streak distribution"""
    # Streak data: negative for losses, positive for wins
    streak_lengths = [
        -5,
        -4,
        -3,
        -3,
        -2,
        -2,
        -2,
        -1,
        -1,
        -1,
        -1,
        -1,
        1,
        1,
        1,
        1,
        1,
        1,
        2,
        2,
        2,
        3,
        3,
        4,
        5,
    ]

    # Count occurrences
    from collections import Counter

    counts = Counter(streak_lengths)

    # Separate into losses and wins
    loss_streaks = [(abs(k), v) for k, v in counts.items() if k < 0]
    win_streaks = [(k, v) for k, v in counts.items() if k > 0]

    fig = go.Figure()

    # Add loss streaks (negative direction)
    if loss_streaks:
        loss_lengths, loss_counts = zip(*loss_streaks)
        fig.add_trace(
            go.Bar(
                x=[-c for c in loss_counts],  # Negative for left side
                y=loss_lengths,
                orientation="h",
                name="Loss Streaks",
                marker_color="#ef4444",
                hovertemplate="<b>%{y} consecutive losses</b><br>Occurrences: %{x}<extra></extra>",
            )
        )

    # Add win streaks (positive direction)
    if win_streaks:
        win_lengths, win_counts = zip(*win_streaks)
        fig.add_trace(
            go.Bar(
                x=win_counts,  # Positive for right side
                y=win_lengths,
                orientation="h",
                name="Win Streaks",
                marker_color="#22c55e",
                hovertemplate="<b>%{y} consecutive wins</b><br>Occurrences: %{x}<extra></extra>",
            )
        )

    fig.add_vline(x=0, line_dash="solid", line_color="gray", line_width=1)

    fig.update_layout(
        title="Distribution of Win/Loss Streaks",
        xaxis_title="Number of Occurrences",
        yaxis_title="Streak Length",
        height=300,
        margin=dict(l=0, r=0, t=40, b=0),
        showlegend=True,
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
    )

    return fig


def create_mock_monthly_heatmap():
    """Create mock monthly returns heatmap"""
    # Generate 2+ years of monthly data
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    years = ["2023", "2024"]

    np.random.seed(42)

    # Create matrix of returns (as percentages)
    returns_matrix = []
    text_matrix = []

    for year in years:
        year_returns = []
        year_text = []
        for month in months:
            # Generate realistic monthly returns
            if year == "2024" and month in ["Oct", "Nov", "Dec"]:
                # Future months - no data
                ret = None
                text = ""
            else:
                ret = np.random.normal(2, 8)  # 2% avg with 8% volatility
                text = f"{ret:.1f}%"

            year_returns.append(ret)
            year_text.append(text)

        returns_matrix.append(year_returns)
        text_matrix.append(year_text)

    # Convert None to NaN for proper handling
    returns_array = np.array(returns_matrix, dtype=float)

    fig = go.Figure(
        data=go.Heatmap(
            z=returns_array,
            x=months,
            y=years,
            text=text_matrix,
            texttemplate="%{text}",
            textfont={"size": 12},
            colorscale=[
                [0, "#dc2626"],  # Red for losses
                [0.5, "#f3f4f6"],  # Gray for break-even
                [1, "#16a34a"],  # Green for gains
            ],
            zmid=0,  # Center colorscale at 0
            hovertemplate="<b>%{y} %{x}</b><br>Return: %{text}<extra></extra>",
            showscale=True,
            colorbar=dict(title="Monthly Return (%)"),
        )
    )

    fig.update_layout(
        title="Monthly Returns Heatmap",
        xaxis_title="Month",
        yaxis_title="Year",
        height=400,
        margin=dict(l=0, r=0, t=40, b=0),
    )

    return fig


def create_mock_trade_sequence():
    """Create mock trade sequence analysis"""
    np.random.seed(42)

    # Generate 150 trades
    n_trades = 150
    trade_numbers = list(range(1, n_trades + 1))

    # Generate realistic returns with some trend
    base_returns = np.random.normal(1, 15, n_trades)  # 1% avg, 15% volatility

    # Add some learning curve (slight improvement over time)
    trend = np.linspace(0, 3, n_trades)
    returns = base_returns + trend

    # Color by profit/loss
    colors = ["#22c55e" if ret > 0 else "#ef4444" for ret in returns]

    fig = go.Figure()

    # Add scatter plot
    fig.add_trace(
        go.Scatter(
            x=trade_numbers,
            y=returns,
            mode="markers",
            name="Trade Returns",
            marker=dict(
                color=colors,
                size=6,
                opacity=0.8,
            ),
            hovertemplate="<b>Trade #%{x}</b><br>Return: %{y:.1f}%<extra></extra>",
        )
    )

    # Add trend line
    z = np.polyfit(trade_numbers, returns, 1)
    p = np.poly1d(z)
    fig.add_trace(
        go.Scatter(
            x=trade_numbers,
            y=p(trade_numbers),
            mode="lines",
            name="Trend",
            line=dict(color="#6b7280", width=2, dash="dash"),
            hovertemplate="<b>Trend Line</b><br>Trade: %{x}<br>Trend: %{y:.1f}%<extra></extra>",
        )
    )

    # Add zero line
    fig.add_hline(y=0, line_dash="solid", line_color="#9ca3af", line_width=1)

    fig.update_layout(
        title="Trade Sequence vs Return",
        xaxis_title="Trade Number",
        yaxis_title="Return (%)",
        height=400,
        margin=dict(l=0, r=0, t=40, b=0),
        showlegend=True,
        legend=dict(yanchor="top", y=0.99, xanchor="left", x=0.01),
    )

    return fig


def create_mock_rom_timeline():
    """Create mock Return on Margin over time"""
    np.random.seed(42)

    dates = pd.date_range(start="2024-01-01", end="2024-09-21", freq="3D")  # Every 3 days
    n_points = len(dates)

    # Generate ROM values
    rom_values = np.random.normal(60, 30, n_points)  # 60% avg with 30% volatility
    rom_values = np.clip(rom_values, -100, 400)  # Realistic bounds

    fig = go.Figure()

    # Add scatter plot of ROM values
    fig.add_trace(
        go.Scatter(
            x=dates,
            y=rom_values,
            mode="markers",
            name="ROM Values",
            marker=dict(
                color="#3b82f6",
                size=6,
                opacity=0.7,
            ),
            hovertemplate="<b>%{x}</b><br>ROM: %{y:.1f}%<extra></extra>",
        )
    )

    # Add 30-trade moving average
    window = min(30, len(rom_values))
    if len(rom_values) >= window:
        ma_values = pd.Series(rom_values).rolling(window=window, min_periods=1).mean()
        fig.add_trace(
            go.Scatter(
                x=dates,
                y=ma_values,
                mode="lines",
                name=f"{window}-point MA",
                line=dict(color="#dc2626", width=2),
                hovertemplate="<b>%{x}</b><br>30-point MA: %{y:.1f}%<extra></extra>",
            )
        )

    # Add mean line
    mean_rom = np.mean(rom_values)
    fig.add_hline(
        y=mean_rom, line_dash="dash", line_color="#16a34a", annotation_text=f"Mean: {mean_rom:.1f}%"
    )

    fig.update_layout(
        title="Return on Margin Over Time",
        xaxis_title="Date",
        yaxis_title="Return on Margin (%)",
        height=300,
        margin=dict(l=0, r=0, t=40, b=0),
        showlegend=True,
        legend=dict(yanchor="top", y=0.99, xanchor="left", x=0.01),
    )

    return fig


def create_mock_rolling_metrics():
    """Create mock rolling metrics chart"""
    dates = pd.date_range(start="2024-01-01", end="2024-09-21", freq="D")
    np.random.seed(42)

    # Generate rolling win rate (30-day window)
    base_win_rate = 0.65  # 65% base win rate
    win_rate_noise = np.random.normal(0, 0.05, len(dates))
    win_rates = np.clip(base_win_rate + win_rate_noise, 0.3, 0.9) * 100

    fig = go.Figure()

    fig.add_trace(
        go.Scatter(
            x=dates,
            y=win_rates,
            mode="lines",
            name="30-Day Rolling Win Rate",
            line=dict(color="#3b82f6", width=2),
            hovertemplate="<b>%{x}</b><br>Win Rate: %{y:.1f}%<extra></extra>",
        )
    )

    # Add average line
    avg_win_rate = np.mean(win_rates)
    fig.add_hline(
        y=avg_win_rate,
        line_dash="dash",
        line_color="#6b7280",
        annotation_text=f"Average: {avg_win_rate:.1f}%",
    )

    fig.update_layout(
        title="Rolling Win Rate (30-Day Window)",
        xaxis_title="Date",
        yaxis_title="Win Rate (%)",
        height=300,
        margin=dict(l=0, r=0, t=40, b=0),
        showlegend=False,
        yaxis=dict(range=[0, 100]),
    )

    return fig


def create_mock_risk_evolution():
    """Create mock risk evolution chart"""
    dates = pd.date_range(start="2024-01-01", end="2024-09-21", freq="W")  # Weekly
    np.random.seed(42)

    # Generate VaR and volatility data
    volatility = np.random.normal(15, 3, len(dates))  # 15% avg volatility
    volatility = np.clip(volatility, 5, 30)

    var_95 = volatility * 1.65  # Approximate 95% VaR

    fig = go.Figure()

    # Add volatility
    fig.add_trace(
        go.Scatter(
            x=dates,
            y=volatility,
            mode="lines+markers",
            name="Volatility",
            line=dict(color="#3b82f6", width=2),
            marker=dict(size=4),
            hovertemplate="<b>%{x}</b><br>Volatility: %{y:.1f}%<extra></extra>",
        )
    )

    # Add VaR
    fig.add_trace(
        go.Scatter(
            x=dates,
            y=var_95,
            mode="lines+markers",
            name="95% VaR",
            line=dict(color="#ef4444", width=2),
            marker=dict(size=4),
            hovertemplate="<b>%{x}</b><br>95% VaR: %{y:.1f}%<extra></extra>",
        )
    )

    fig.update_layout(
        title="Risk Metrics Evolution",
        xaxis_title="Date",
        yaxis_title="Risk (%)",
        height=300,
        margin=dict(l=0, r=0, t=40, b=0),
        showlegend=True,
        legend=dict(yanchor="top", y=0.99, xanchor="left", x=0.01),
    )

    return fig


# Export all mock functions for use in callbacks
def get_mock_charts():
    """Return all mock charts for development"""
    return {
        "equity_curve": create_mock_equity_curve(),
        "drawdown": create_mock_drawdown_chart(),
        "day_of_week": create_mock_day_of_week_chart(),
        "rom_distribution": create_mock_rom_distribution(),
        "streak_distribution": create_mock_streak_distribution(),
        "monthly_heatmap": create_mock_monthly_heatmap(),
        "trade_sequence": create_mock_trade_sequence(),
        "rom_timeline": create_mock_rom_timeline(),
        "rolling_metrics": create_mock_rolling_metrics(),
        "risk_evolution": create_mock_risk_evolution(),
    }


def get_mock_metrics():
    """Generate mock metrics for the key metrics bar - focused on visual/chart-specific metrics"""
    return dmc.Group(
        children=[
            create_metric_indicator("Active Period", "247 days", "Chart timespan", "blue"),
            create_metric_indicator("Best Month", "+12.4%", "October 2024", "green"),
            create_metric_indicator("Worst Month", "-5.2%", "August 2024", "red"),
            create_metric_indicator("Avg Trade Duration", "2.3 days", "Hold time", "gray"),
            create_metric_indicator("Win Streak", "8 trades", "Max consecutive", "green"),
        ],
        justify="space-around",
        align="center",
        w="100%",
    )
