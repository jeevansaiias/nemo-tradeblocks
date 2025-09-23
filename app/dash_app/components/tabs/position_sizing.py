"""
🎯 Position Sizing Tab - Optimal Position Sizing Analysis

Advanced position sizing strategies and risk management tools for portfolio optimization.
Features Kelly Criterion, Risk of Ruin, and comparative position sizing methodologies.
"""

import dash_mantine_components as dmc
from dash import html, dcc
from dash_iconify import DashIconify
import plotly.graph_objects as go

from ..common import create_info_tooltip


def create_position_sizing_tab():
    """Create the Position Sizing tab with comprehensive risk management tools"""
    return dmc.Stack(
        children=[
            # Header with title and description
            dmc.Group(
                [
                    dmc.Stack(
                        [
                            dmc.Title("🎯 Position Sizing Analysis", order=2),
                            dmc.Text(
                                "Optimize your position sizing strategy using proven mathematical frameworks and risk management principles.",
                                size="sm",
                                c="dimmed",
                            ),
                        ],
                        gap="xs",
                    ),
                ],
                justify="space-between",
                align="center",
            ),
            # Kelly Criterion Section
            dmc.Paper(
                children=[
                    dmc.Stack(
                        [
                            dmc.Group(
                                [
                                    dmc.Title("🧱 Kelly Criterion", order=3),
                                    create_info_tooltip(
                                        title="🎯 Kelly Criterion",
                                        content="Mathematically optimal position sizing based on your historical win rate and average win/loss ratio. Maximizes long-term growth while managing risk of ruin.",
                                        detailed_content="Formula: f = (bp - q) / b, where b = avg_win/avg_loss, p = win_probability, q = 1-p. Many traders use fractional Kelly (25-50%) for more conservative approach. TradeBlocks builds insights, not investment advice.",
                                        tooltip_id="kelly-criterion",
                                    ),
                                ],
                                justify="space-between",
                            ),
                            html.Div(id="position-sizing-kelly-analysis"),
                        ],
                        gap="md",
                    )
                ],
                p="lg",
                withBorder=True,
            ),
            # Coming Soon Section - Additional Position Sizing Tools
            dmc.Center(
                children=[
                    dmc.Stack(
                        children=[
                            dmc.Center(
                                dmc.Text(
                                    "🎯",
                                    size="120px",
                                    style={"lineHeight": "1", "fontSize": "120px"},
                                )
                            ),
                            dmc.Title(
                                "🎯 Advanced Position Sizing Tools",
                                order=2,
                                ta="center",
                                c="orange.6",
                            ),
                            dmc.Title(
                                "More Features Coming Soon", order=3, ta="center", c="dimmed"
                            ),
                            dmc.Text(
                                "Building powerful position sizing tools to optimize your risk management and maximize long-term growth",
                                ta="center",
                                size="lg",
                                c="dimmed",
                                w=600,
                            ),
                            dmc.Stack(
                                children=[
                                    dmc.Paper(
                                        children=[
                                            dmc.Text(
                                                "🎯 Planned Features:", fw=600, size="md", mb="sm"
                                            ),
                                            dmc.List(
                                                children=[
                                                    dmc.ListItem(
                                                        "Position Sizing Methods Comparison (Fixed Fractional vs Kelly variants)"
                                                    ),
                                                    dmc.ListItem(
                                                        "Risk of Ruin Calculator with interactive probability charts"
                                                    ),
                                                    dmc.ListItem(
                                                        "Position Size Backtester - replay trades with different sizing"
                                                    ),
                                                    dmc.ListItem(
                                                        "Strategy Allocation Optimizer using modern portfolio theory"
                                                    ),
                                                    dmc.ListItem(
                                                        "Volatility-based sizing with dynamic risk adjustment"
                                                    ),
                                                    dmc.ListItem(
                                                        "Confidence-based sizing for hot/cold streak management"
                                                    ),
                                                ],
                                                spacing="xs",
                                                size="sm",
                                                c="dimmed",
                                            ),
                                        ],
                                        p="md",
                                        withBorder=True,
                                        radius="md",
                                        style={"maxWidth": "600px"},
                                    ),
                                ],
                                gap="lg",
                                align="center",
                            ),
                        ],
                        gap="lg",
                        align="center",
                    )
                ],
                style={"minHeight": "60vh"},
            ),
        ],
        gap="xl",
        p="lg",
    )
