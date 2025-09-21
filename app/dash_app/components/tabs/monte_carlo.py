import dash_mantine_components as dmc
from dash import html, dcc
from dash_iconify import DashIconify
import plotly.graph_objects as go
import numpy as np


def create_monte_carlo_tab():
    """Create the Monte Carlo Simulator tab"""
    return dmc.Stack(
        children=[
            # Title and controls
            dmc.Group(
                children=[
                    dmc.Title("Monte Carlo Simulator", order=2),
                    dmc.Group(
                        children=[
                            dmc.Select(
                                id="mc-strategy-select",
                                label="Strategy",
                                data=[],
                                placeholder="All strategies",
                                style={"width": "200px"},
                            ),
                            dmc.NumberInput(
                                id="mc-simulations",
                                label="Simulations",
                                value=1000,
                                min=100,
                                max=10000,
                                step=100,
                                style={"width": "150px"},
                            ),
                            dmc.NumberInput(
                                id="mc-days-forward",
                                label="Days Forward",
                                value=252,
                                min=30,
                                max=1000,
                                step=30,
                                style={"width": "150px"},
                            ),
                            dmc.Button(
                                "Run Simulation",
                                id="run-mc-button",
                                leftSection=DashIconify(icon="tabler:play"),
                                color="blue",
                            ),
                        ],
                        gap="md",
                    ),
                ],
                justify="space-between",
            ),
            # Results section
            dmc.SimpleGrid(
                cols={"base": 1, "lg": 2},
                spacing="md",
                children=[
                    # Simulation paths
                    dmc.Paper(
                        children=[
                            dmc.Title("Simulation Paths", order=4, mb="md"),
                            dcc.Graph(id="mc-paths-chart"),
                        ],
                        p="md",
                        withBorder=True,
                    ),
                    # Distribution of outcomes
                    dmc.Paper(
                        children=[
                            dmc.Title("Final Value Distribution", order=4, mb="md"),
                            dcc.Graph(id="mc-distribution-chart"),
                        ],
                        p="md",
                        withBorder=True,
                    ),
                    # Risk metrics
                    dmc.Paper(
                        children=[
                            dmc.Title("Risk Metrics", order=4, mb="md"),
                            html.Div(id="mc-risk-metrics"),
                        ],
                        p="md",
                        withBorder=True,
                    ),
                    # Percentiles
                    dmc.Paper(
                        children=[
                            dmc.Title("Confidence Intervals", order=4, mb="md"),
                            html.Div(id="mc-percentiles"),
                        ],
                        p="md",
                        withBorder=True,
                    ),
                ],
            ),
        ],
        gap="lg",
    )


def create_mc_paths_chart(mc_result):
    """Create Monte Carlo simulation paths chart"""
    if not mc_result or "simulations" not in mc_result:
        return go.Figure()

    simulations = mc_result["simulations"]

    # Show only first 100 paths for performance
    paths_to_show = min(100, len(simulations))

    fig = go.Figure()

    for i in range(paths_to_show):
        fig.add_trace(
            go.Scatter(
                y=simulations[i],
                mode="lines",
                line=dict(width=1, color="rgba(0,100,255,0.1)"),
                showlegend=False,
                hovertemplate="Day %{x}<br>Return: %{y:.2f}<extra></extra>",
            )
        )

    # Add median path
    if simulations:
        median_path = np.median(simulations, axis=0)
        fig.add_trace(
            go.Scatter(
                y=median_path, mode="lines", line=dict(width=3, color="red"), name="Median Path"
            )
        )

    fig.update_layout(
        title="Monte Carlo Simulation Paths",
        xaxis_title="Days",
        yaxis_title="Cumulative Return",
        height=400,
        margin=dict(l=0, r=0, t=40, b=0),
    )

    return fig


def create_mc_distribution_chart(mc_result):
    """Create final value distribution chart"""
    if not mc_result or "final_values" not in mc_result:
        return go.Figure()

    final_values = mc_result["final_values"]

    fig = go.Figure()

    fig.add_trace(go.Histogram(x=final_values, nbinsx=50, name="Final Values", opacity=0.7))

    # Add percentile lines
    if "percentiles" in mc_result:
        percentiles = mc_result["percentiles"]
        for key, value in percentiles.items():
            fig.add_vline(x=value, line_dash="dash", annotation_text=f"{key}: {value:.2f}")

    fig.update_layout(
        title="Distribution of Final Values",
        xaxis_title="Final Return",
        yaxis_title="Frequency",
        height=400,
        margin=dict(l=0, r=0, t=40, b=0),
    )

    return fig


def create_risk_metrics_display(mc_result):
    """Create risk metrics display"""
    if not mc_result:
        return dmc.Text("No data available", c="dimmed")

    metrics = [
        ("Expected Return", f"{mc_result.get('expected_return', 0):.2f}"),
        ("Standard Deviation", f"{mc_result.get('std_deviation', 0):.2f}"),
        ("Value at Risk (95%)", f"{mc_result.get('var_95', 0):.2f}"),
    ]

    return dmc.Stack(
        children=[
            dmc.Group(
                children=[dmc.Text(label, fw=500), dmc.Text(value, c="blue")],
                justify="space-between",
            )
            for label, value in metrics
        ],
        gap="sm",
    )


def create_percentiles_display(mc_result):
    """Create percentiles display"""
    if not mc_result or "percentiles" not in mc_result:
        return dmc.Text("No data available", c="dimmed")

    percentiles = mc_result["percentiles"]

    return dmc.Stack(
        children=[
            dmc.Group(
                children=[
                    dmc.Text(f"{key.replace('p', '')}th Percentile", fw=500),
                    dmc.Text(f"{value:.2f}", c="blue"),
                ],
                justify="space-between",
            )
            for key, value in percentiles.items()
        ],
        gap="sm",
    )
