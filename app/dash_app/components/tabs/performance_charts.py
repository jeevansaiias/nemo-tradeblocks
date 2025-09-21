import dash_mantine_components as dmc
from dash import html, dcc
from dash_iconify import DashIconify
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime, timedelta
import numpy as np
import pandas as pd


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
                        style={"height": "500px"},
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
                        style={"height": "300px"},
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
