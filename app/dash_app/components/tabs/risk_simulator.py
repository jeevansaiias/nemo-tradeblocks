"""
🎲 Risk Simulator Tab - Monte Carlo Analysis with Bootstrap Resampling

Advanced risk simulation using historical trade data to project future outcomes.
Features bootstrap resampling to preserve real distribution characteristics.
"""

import dash_mantine_components as dmc
from dash import html, dcc
from dash_iconify import DashIconify
import plotly.graph_objects as go
import numpy as np


def create_risk_simulator_tab():
    """Create the Risk Simulator tab with Monte Carlo controls"""
    return dmc.Stack(
        children=[
            # Header with title
            dmc.Group(
                [
                    dmc.Title("🎲 Risk Simulator", order=2),
                    dmc.Text(
                        "Monte Carlo projections using your actual trading history",
                        size="sm",
                        c="dimmed",
                    ),
                ],
                justify="space-between",
                align="center",
                mb="lg",
            ),
            # Controls Section
            create_simulation_controls(),
            # Results Section
            dmc.Stack(
                [
                    # Main Equity Curve Visualization
                    create_equity_curve_section(),
                    # Statistics Grid
                    create_statistics_grid(),
                    # Additional Analysis Tabs
                    create_analysis_tabs(),
                ],
                gap="lg",
            ),
        ],
        gap="lg",
    )


def create_simulation_controls():
    """Create the control panel for simulation parameters"""
    return dmc.Paper(
        children=[
            dmc.Stack(
                [
                    dmc.Text("Simulation Parameters", size="lg", fw=600),
                    dmc.Grid(
                        [
                            # Left column - Main controls
                            dmc.GridCol(
                                [
                                    dmc.Stack(
                                        [
                                            # Number of simulations
                                            dmc.NumberInput(
                                                id="mc-num-simulations",
                                                label="Number of Simulations",
                                                description="More simulations = better accuracy",
                                                value=1000,
                                                min=100,
                                                max=10000,
                                                step=100,
                                                leftSection=DashIconify(
                                                    icon="tabler:refresh", width=16
                                                ),
                                            ),
                                            # Time horizon
                                            dmc.Select(
                                                id="mc-time-horizon",
                                                label="Time Horizon",
                                                description="How far to project into the future",
                                                data=[
                                                    {"value": "30", "label": "30 Days"},
                                                    {"value": "60", "label": "60 Days"},
                                                    {"value": "90", "label": "90 Days"},
                                                    {"value": "180", "label": "6 Months"},
                                                    {"value": "252", "label": "1 Year"},
                                                    {"value": "504", "label": "2 Years"},
                                                ],
                                                value="252",
                                                leftSection=DashIconify(
                                                    icon="tabler:calendar", width=16
                                                ),
                                            ),
                                            # Bootstrap method
                                            dmc.RadioGroup(
                                                id="mc-bootstrap-method",
                                                label="Sampling Method",
                                                description="How to resample historical data",
                                                value="trades",
                                                children=dmc.Group(
                                                    [
                                                        dmc.Radio(
                                                            "Individual Trades", value="trades"
                                                        ),
                                                        dmc.Radio("Daily Returns", value="daily"),
                                                    ]
                                                ),
                                            ),
                                        ],
                                        gap="md",
                                    )
                                ],
                                span=4,
                            ),
                            # Middle column - Strategy selection
                            dmc.GridCol(
                                [
                                    dmc.Stack(
                                        [
                                            dmc.Text("Strategy Selection", size="sm", fw=500),
                                            dmc.CheckboxGroup(
                                                id="mc-strategy-selection",
                                                label="Include Strategies",
                                                description="Select strategies to simulate",
                                                value=["all"],
                                                children=dmc.Stack(
                                                    [
                                                        dmc.Checkbox(
                                                            label="All Strategies",
                                                            value="all",
                                                        ),
                                                    ],
                                                    gap="xs",
                                                ),
                                            ),
                                            # Initial capital
                                            dmc.NumberInput(
                                                id="mc-initial-capital",
                                                label="Initial Capital ($)",
                                                description="Starting portfolio value",
                                                value=100000,
                                                min=1000,
                                                max=10000000,
                                                step=1000,
                                                leftSection=DashIconify(
                                                    icon="tabler:currency-dollar", width=16
                                                ),
                                            ),
                                        ],
                                        gap="md",
                                    )
                                ],
                                span=4,
                            ),
                            # Right column - Advanced settings
                            dmc.GridCol(
                                [
                                    dmc.Stack(
                                        [
                                            dmc.Text("Confidence Levels", size="sm", fw=500),
                                            dmc.CheckboxGroup(
                                                id="mc-confidence-levels",
                                                label="Display Percentiles",
                                                description="Confidence bands to show",
                                                value=["p5", "p25", "p50", "p75", "p95"],
                                                children=dmc.Stack(
                                                    [
                                                        dmc.Checkbox("5th Percentile", value="p5"),
                                                        dmc.Checkbox(
                                                            "25th Percentile", value="p25"
                                                        ),
                                                        dmc.Checkbox(
                                                            "50th Percentile (Median)", value="p50"
                                                        ),
                                                        dmc.Checkbox(
                                                            "75th Percentile", value="p75"
                                                        ),
                                                        dmc.Checkbox(
                                                            "95th Percentile", value="p95"
                                                        ),
                                                    ],
                                                    gap="xs",
                                                ),
                                            ),
                                        ],
                                        gap="md",
                                    )
                                ],
                                span=4,
                            ),
                        ],
                        gutter="xl",
                    ),
                    # Run Simulation Button
                    dmc.Group(
                        [
                            dmc.Button(
                                "Run Simulation",
                                id="mc-run-simulation",
                                leftSection=DashIconify(icon="tabler:player-play", width=16),
                                variant="filled",
                                size="lg",
                                color="green",
                            ),
                            dmc.Button(
                                "Reset",
                                id="mc-reset",
                                leftSection=DashIconify(icon="tabler:refresh", width=16),
                                variant="light",
                                size="lg",
                            ),
                            dmc.Text(
                                id="mc-status",
                                children="Ready to simulate",
                                c="dimmed",
                                size="sm",
                            ),
                        ],
                        justify="center",
                    ),
                ],
                gap="lg",
            )
        ],
        p="lg",
        withBorder=True,
    )


def create_equity_curve_section():
    """Create the main equity curve visualization"""
    return dmc.Paper(
        children=[
            dmc.Stack(
                [
                    dmc.Group(
                        [
                            dmc.Text("Portfolio Growth Projections", size="lg", fw=600),
                            dmc.Group(
                                [
                                    dmc.Switch(
                                        id="mc-log-scale",
                                        label="Log Scale",
                                        size="sm",
                                        checked=False,
                                    ),
                                    dmc.Switch(
                                        id="mc-show-paths",
                                        label="Show Individual Paths",
                                        size="sm",
                                        checked=False,
                                    ),
                                ],
                                gap="md",
                            ),
                        ],
                        justify="space-between",
                        align="center",
                    ),
                    # Chart placeholder
                    dcc.Graph(
                        id="mc-equity-curve",
                        config={"displayModeBar": True, "displaylogo": False},
                        style={"height": "500px"},
                        figure=create_empty_chart(
                            "Upload data and click 'Run Simulation' to see projections",
                            "Portfolio Value Projections",
                        ),
                    ),
                    # Legend
                    dmc.Group(
                        [
                            dmc.Badge("Median (50th)", color="blue", variant="light"),
                            dmc.Badge("25th-75th Percentile", color="green", variant="light"),
                            dmc.Badge("5th-95th Percentile", color="gray", variant="light"),
                        ],
                        gap="sm",
                        justify="center",
                    ),
                ],
                gap="md",
            )
        ],
        p="lg",
        withBorder=True,
    )


def create_statistics_grid():
    """Create grid of key statistics"""
    return dmc.SimpleGrid(
        cols=4,
        spacing="md",
        children=[
            create_stat_card(
                title="Expected Return",
                value_id="mc-expected-return",
                subtitle_id="mc-expected-return-desc",
                icon="tabler:trending-up",
                color="green",
            ),
            create_stat_card(
                title="Value at Risk (95%)",
                value_id="mc-var-95",
                subtitle_id="mc-var-95-desc",
                icon="tabler:alert-triangle",
                color="red",
            ),
            create_stat_card(
                title="Probability of Profit",
                value_id="mc-prob-profit",
                subtitle_id="mc-prob-profit-desc",
                icon="tabler:percentage",
                color="blue",
            ),
            create_stat_card(
                title="Max Drawdown (95th)",
                value_id="mc-max-drawdown",
                subtitle_id="mc-max-drawdown-desc",
                icon="tabler:chart-line",
                color="orange",
            ),
        ],
    )


def create_stat_card(title, value_id, subtitle_id, icon, color):
    """Create a statistic card"""
    return dmc.Paper(
        children=[
            dmc.Stack(
                [
                    dmc.Group(
                        [
                            DashIconify(icon=icon, width=20, color=color),
                            dmc.Text(title, size="sm", c="dimmed"),
                        ],
                        gap="xs",
                    ),
                    dmc.Text("--", id=value_id, size="xl", fw=700),
                    dmc.Text("Waiting for simulation", id=subtitle_id, size="xs", c="dimmed"),
                ],
                gap="xs",
            )
        ],
        p="md",
        withBorder=True,
    )


def create_analysis_tabs():
    """Create additional analysis tabs"""
    return dmc.Paper(
        children=[
            dmc.Tabs(
                value="distribution",
                children=[
                    dmc.TabsList(
                        [
                            dmc.TabsTab("Return Distribution", value="distribution"),
                            dmc.TabsTab("Drawdown Analysis", value="drawdown"),
                            dmc.TabsTab("Position Sizing", value="kelly"),
                            dmc.TabsTab("Scenario Analysis", value="scenarios"),
                        ]
                    ),
                    # Distribution Tab
                    dmc.TabsPanel(
                        children=[
                            dcc.Graph(
                                id="mc-return-distribution",
                                config={"displayModeBar": False},
                                style={"height": "400px"},
                                figure=create_empty_chart(
                                    "Run simulation to see return distribution",
                                    "Return Distribution",
                                ),
                            )
                        ],
                        value="distribution",
                    ),
                    # Drawdown Tab
                    dmc.TabsPanel(
                        children=[
                            dcc.Graph(
                                id="mc-drawdown-analysis",
                                config={"displayModeBar": False},
                                style={"height": "400px"},
                                figure=create_empty_chart(
                                    "Run simulation to see drawdown analysis", "Drawdown Analysis"
                                ),
                            )
                        ],
                        value="drawdown",
                    ),
                    # Kelly Tab
                    dmc.TabsPanel(
                        children=[
                            dmc.Stack(
                                [
                                    dmc.Alert(
                                        children="Position sizing recommendations based on Kelly Criterion",
                                        color="blue",
                                        variant="light",
                                    ),
                                    html.Div(id="mc-kelly-analysis"),
                                ],
                                gap="md",
                            )
                        ],
                        value="kelly",
                    ),
                    # Scenarios Tab
                    dmc.TabsPanel(
                        children=[
                            dmc.Stack(
                                [
                                    dmc.Alert(
                                        children="Best/worst case scenarios based on historical data",
                                        color="gray",
                                        variant="light",
                                    ),
                                    html.Div(id="mc-scenario-analysis"),
                                ],
                                gap="md",
                            )
                        ],
                        value="scenarios",
                    ),
                ],
            )
        ],
        p="lg",
        withBorder=True,
    )


def create_empty_chart(message, title):
    """Create an empty chart with a message"""
    fig = go.Figure()

    fig.update_layout(
        title=title,
        xaxis=dict(showgrid=False, showticklabels=False, zeroline=False),
        yaxis=dict(showgrid=False, showticklabels=False, zeroline=False),
        annotations=[
            dict(
                text=message,
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
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
    )

    return fig
