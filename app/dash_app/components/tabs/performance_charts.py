import dash_mantine_components as dmc
from dash import html, dcc
from dash_iconify import DashIconify
import plotly.graph_objects as go
import plotly.express as px
from datetime import datetime


def create_performance_charts_tab():
    """Create the Performance Charts tab"""
    return dmc.Stack(
        children=[
            # Title and controls
            dmc.Group(
                children=[
                    dmc.Title("Performance Charts", order=2),
                    dmc.Group(
                        children=[
                            dmc.Select(
                                id="chart-timeframe",
                                label="Timeframe",
                                data=[
                                    {"value": "all", "label": "All Time"},
                                    {"value": "ytd", "label": "Year to Date"},
                                    {"value": "6m", "label": "Last 6 Months"},
                                    {"value": "3m", "label": "Last 3 Months"},
                                    {"value": "1m", "label": "Last Month"},
                                ],
                                value="all",
                                style={"width": "150px"},
                            ),
                            dmc.Switch(id="cumulative-toggle", label="Cumulative", checked=True),
                        ],
                        gap="md",
                    ),
                ],
                justify="space-between",
            ),
            # Main performance chart
            dmc.Paper(
                children=[
                    dmc.Title("Cumulative P/L", order=4, mb="md"),
                    dcc.Graph(
                        id="cumulative-pl-chart",
                        config={"responsive": True, "displayModeBar": False},
                        style={"height": "500px"},
                    ),
                ],
                p="md",
                withBorder=True,
            ),
            # Secondary charts grid
            dmc.SimpleGrid(
                cols={"base": 1, "lg": 2},
                spacing="md",
                children=[
                    # Drawdown chart
                    dmc.Paper(
                        children=[
                            dmc.Title("Drawdown", order=4, mb="md"),
                            dcc.Graph(
                                id="drawdown-chart",
                                config={"responsive": True, "displayModeBar": False},
                                style={"height": "400px"},
                            ),
                        ],
                        p="md",
                        withBorder=True,
                    ),
                    # Daily P/L chart
                    dmc.Paper(
                        children=[
                            dmc.Title("Daily P/L", order=4, mb="md"),
                            dcc.Graph(
                                id="daily-pl-chart",
                                config={"responsive": True, "displayModeBar": False},
                                style={"height": "400px"},
                            ),
                        ],
                        p="md",
                        withBorder=True,
                    ),
                    # Rolling metrics
                    dmc.Paper(
                        children=[
                            dmc.Title("Rolling Sharpe Ratio (30-day)", order=4, mb="md"),
                            dcc.Graph(
                                id="rolling-sharpe-chart",
                                config={"responsive": True, "displayModeBar": False},
                                style={"height": "400px"},
                            ),
                        ],
                        p="md",
                        withBorder=True,
                    ),
                    # Monthly heatmap
                    dmc.Paper(
                        children=[
                            dmc.Title("Monthly Returns Heatmap", order=4, mb="md"),
                            dcc.Graph(
                                id="monthly-heatmap",
                                config={"responsive": True, "displayModeBar": False},
                                style={"height": "400px"},
                            ),
                        ],
                        p="md",
                        withBorder=True,
                    ),
                ],
            ),
        ],
        gap="lg",
    )


def create_cumulative_pl_chart(performance_data):
    """Create cumulative P/L chart"""
    if not performance_data or "cumulative_pl" not in performance_data:
        return go.Figure()

    cumulative_data = performance_data["cumulative_pl"]

    dates = [entry["date"] for entry in cumulative_data]
    cumulative_pl = [entry["cumulative_pl"] for entry in cumulative_data]

    fig = go.Figure()

    # Add cumulative P/L line
    fig.add_trace(
        go.Scatter(
            x=dates,
            y=cumulative_pl,
            mode="lines",
            name="Cumulative P/L",
            line=dict(color="blue", width=2),
        )
    )

    # Add zero line
    fig.add_hline(y=0, line_dash="dash", line_color="gray", annotation_text="Break-even")

    fig.update_layout(
        title="Portfolio Cumulative P/L",
        xaxis_title="Date",
        yaxis_title="Cumulative P/L ($)",
        hovermode="x unified",
        height=500,
        margin=dict(l=0, r=0, t=40, b=0),
        autosize=False,
    )

    return fig


def create_drawdown_chart(performance_data):
    """Create drawdown chart"""
    if not performance_data or "drawdown" not in performance_data:
        return go.Figure()

    drawdown_data = performance_data["drawdown"]

    dates = [entry["date"] for entry in drawdown_data]
    drawdown = [entry["drawdown"] * 100 for entry in drawdown_data]  # Convert to percentage

    fig = go.Figure()

    fig.add_trace(
        go.Scatter(
            x=dates,
            y=drawdown,
            mode="lines",
            name="Drawdown",
            line=dict(color="red", width=2),
            fill="tonexty",
            fillcolor="rgba(255, 0, 0, 0.2)",
        )
    )

    fig.update_layout(
        title="Portfolio Drawdown",
        xaxis_title="Date",
        yaxis_title="Drawdown (%)",
        hovermode="x unified",
        height=400,
        margin=dict(l=0, r=0, t=40, b=0),
        autosize=False,
    )

    return fig


def create_daily_pl_chart(performance_data):
    """Create daily P/L bar chart"""
    if not performance_data or "daily_pl" not in performance_data:
        return go.Figure()

    daily_data = performance_data["daily_pl"]

    dates = [entry["date"] for entry in daily_data]
    daily_pl = [entry["pl"] for entry in daily_data]

    # Color bars based on positive/negative
    colors = ["green" if pl >= 0 else "red" for pl in daily_pl]

    fig = go.Figure()

    fig.add_trace(go.Bar(x=dates, y=daily_pl, name="Daily P/L", marker_color=colors))

    fig.add_hline(y=0, line_dash="dash", line_color="gray")

    fig.update_layout(
        title="Daily P/L",
        xaxis_title="Date",
        yaxis_title="Daily P/L ($)",
        height=400,
        margin=dict(l=0, r=0, t=40, b=0),
        showlegend=False,
        autosize=False,
    )

    return fig


def create_monthly_heatmap(performance_data):
    """Create monthly returns heatmap"""
    if not performance_data or "monthly_pl" not in performance_data:
        return go.Figure()

    monthly_data = performance_data["monthly_pl"]

    # Process data for heatmap (simplified version)
    months = [entry["month"] for entry in monthly_data]
    returns = [entry["pl"] for entry in monthly_data]

    # Create a simple heatmap (in production, you'd want to organize by year/month grid)
    fig = px.bar(
        x=months, y=returns, title="Monthly Returns", color=returns, color_continuous_scale="RdYlGn"
    )

    fig.update_layout(
        height=400, margin=dict(l=0, r=0, t=40, b=0), showlegend=False, autosize=False
    )

    return fig
