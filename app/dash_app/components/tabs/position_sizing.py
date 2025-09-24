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
            dmc.Group(
                [
                    dmc.Stack(
                        [
                            dmc.Title("🎯 Position Sizing Analysis", order=2),
                            dmc.Text(
                                "Dial in trade sizing with portfolio-aware recommendations, preserved in your browser for quick iteration.",
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
            dmc.Grid(
                children=[
                    dmc.GridCol(
                        span={"base": 12, "lg": 4},
                        children=[
                            dmc.Stack(
                                gap="lg",
                                children=[
                                    dmc.Paper(
                                        children=[
                                            dmc.Stack(
                                                gap="md",
                                                children=[
                                                    dmc.Group(
                                                        [
                                                            dmc.Title(
                                                                "Portfolio Settings",
                                                                order=4,
                                                            ),
                                                            create_info_tooltip(
                                                                title="Portfolio Settings",
                                                                content="Enter capital assumptions and preferred Kelly fraction. Values are saved locally per backtest upload.",
                                                                detailed_content="We fingerprint the uploaded portfolio (filename, trade count, timestamp) and store these preferences in localStorage so you can iterate without re-typing.",
                                                                tooltip_id="ps-portfolio-settings",
                                                            ),
                                                        ],
                                                        justify="space-between",
                                                    ),
                                                    dmc.NumberInput(
                                                        id="ps-starting-capital-input",
                                                        label="Starting Capital ($)",
                                                        description="Net liquidity or capital base for risk sizing",
                                                        min=0,
                                                        step=1000,
                                                        allowNegative=False,
                                                        prefix="$ ",
                                                        thousandSeparator=",",
                                                    ),
                                                    dmc.SegmentedControl(
                                                        id="ps-kelly-fraction-choice",
                                                        data=[
                                                            {
                                                                "label": "Full Kelly",
                                                                "value": "full",
                                                            },
                                                            {
                                                                "label": "Half Kelly",
                                                                "value": "half",
                                                            },
                                                            {
                                                                "label": "Quarter Kelly",
                                                                "value": "quarter",
                                                            },
                                                        ],
                                                        value="full",
                                                        fullWidth=True,
                                                        radius="md",
                                                    ),
                                                    dmc.NumberInput(
                                                        id="ps-target-drawdown-input",
                                                        label="Target Max Drawdown (%)",
                                                        description="Set your comfort zone for peak-to-trough loss",
                                                        min=1,
                                                        max=100,
                                                        step=1,
                                                        allowNegative=False,
                                                    ),
                                                    dmc.Stack(
                                                        [
                                                            dmc.Group(
                                                                [
                                                                    dmc.Button(
                                                                        "Save Settings",
                                                                        id="ps-save-settings",
                                                                        leftSection=DashIconify(
                                                                            icon="tabler:device-floppy",
                                                                            width=16,
                                                                        ),
                                                                        variant="filled",
                                                                        color="green",
                                                                        size="md",
                                                                    ),
                                                                    dmc.Button(
                                                                        "Reset",
                                                                        id="ps-reset-settings",
                                                                        leftSection=DashIconify(
                                                                            icon="tabler:refresh",
                                                                            width=16,
                                                                        ),
                                                                        variant="light",
                                                                        size="md",
                                                                    ),
                                                                ],
                                                                gap="md",
                                                                justify="flex-end",
                                                            ),
                                                            html.Div(
                                                                id="ps-saved-feedback",
                                                                style={"textAlign": "right"},
                                                            ),
                                                        ],
                                                        gap="xs",
                                                        align="flex-end",
                                                    ),
                                                ],
                                            )
                                        ],
                                        p="lg",
                                        withBorder=True,
                                    ),
                                    dmc.Paper(
                                        children=[
                                            dmc.Stack(
                                                gap="sm",
                                                children=[
                                                    dmc.Group(
                                                        [
                                                            dmc.Title(
                                                                "Strategy Overrides",
                                                                order=4,
                                                            ),
                                                            create_info_tooltip(
                                                                title="Strategy Overrides",
                                                                content="Fine-tune position sizing per strategy. Saved locally per portfolio.",
                                                                detailed_content="Overrides will let you cap contracts or adjust Kelly multipliers for individual strategies without changing the global defaults.",
                                                                tooltip_id="ps-strategy-overrides",
                                                            ),
                                                        ],
                                                        justify="space-between",
                                                    ),
                                                    html.Div(
                                                        id="ps-strategy-overrides",
                                                        children=dmc.Alert(
                                                            "Strategy-specific sizing controls are coming soon.",
                                                            color="gray",
                                                            variant="light",
                                                        ),
                                                    ),
                                                ],
                                            )
                                        ],
                                        p="lg",
                                        withBorder=True,
                                    ),
                                ],
                            )
                        ],
                    ),
                    dmc.GridCol(
                        span={"base": 12, "lg": 8},
                        children=[
                            dmc.Stack(
                                gap="lg",
                                children=[
                                    dmc.Paper(
                                        children=[
                                            dmc.Stack(
                                                gap="md",
                                                children=[
                                                    dmc.Group(
                                                        [
                                                            dmc.Title(
                                                                "🧱 Kelly Criterion",
                                                                order=3,
                                                            ),
                                                            create_info_tooltip(
                                                                title="🎯 Kelly Criterion",
                                                                content="Mathematically optimal position sizing based on your historical win rate and average win/loss ratio.",
                                                                detailed_content="Formula: f = (bp - q) / b, where b = avg_win/avg_loss, p = win probability, q = 1 - p. Many traders use fractional Kelly (25-50%) for additional cushion.",
                                                                tooltip_id="kelly-criterion",
                                                            ),
                                                        ],
                                                        justify="space-between",
                                                    ),
                                                    html.Div(id="position-sizing-kelly-analysis"),
                                                    html.Div(id="position-sizing-fraction-tiles"),
                                                ],
                                            )
                                        ],
                                        p="lg",
                                        withBorder=True,
                                    ),
                                    dmc.Paper(
                                        children=[
                                            dmc.Stack(
                                                gap="md",
                                                children=[
                                                    dmc.Group(
                                                        [
                                                            dmc.Title(
                                                                "Margin Utilization",
                                                                order=4,
                                                            ),
                                                            create_info_tooltip(
                                                                title="Margin Utilization",
                                                                content="Track how much of your starting capital historical trades consumed in margin.",
                                                                detailed_content="We compare historical margin requirements against your selected Kelly allocation to highlight potential capital shortfalls.",
                                                                tooltip_id="ps-margin-utilization",
                                                            ),
                                                        ],
                                                        justify="space-between",
                                                        align="center",
                                                    ),
                                                    dcc.Loading(
                                                        dcc.Graph(
                                                            id="position-sizing-margin-chart",
                                                            config={"displayModeBar": False},
                                                            style={"height": "320px"},
                                                        ),
                                                        type="default",
                                                    ),
                                                    html.Div(id="position-sizing-margin-warning"),
                                                ],
                                            )
                                        ],
                                        p="lg",
                                        withBorder=True,
                                    ),
                                    dmc.Paper(
                                        children=[
                                            dmc.Stack(
                                                gap="md",
                                                children=[
                                                    dmc.Title(
                                                        "Roadmap",
                                                        order=4,
                                                    ),
                                                    dmc.Text(
                                                        "Margin-aware sizing curves, replay tools, and allocation optimizers are queued up next.",
                                                        size="sm",
                                                        c="dimmed",
                                                    ),
                                                    dmc.List(
                                                        spacing="xs",
                                                        size="sm",
                                                        c="dimmed",
                                                        children=[
                                                            dmc.ListItem(
                                                                "Compare sizing rules side-by-side (Fixed Fractional, Kelly variants, volatility-based)."
                                                            ),
                                                            dmc.ListItem(
                                                                "Interactive risk of ruin analysis with configurable guardrails."
                                                            ),
                                                            dmc.ListItem(
                                                                "Scenario replays that rebuild equity curves with alternative sizing inputs."
                                                            ),
                                                        ],
                                                    ),
                                                ],
                                            )
                                        ],
                                        p="lg",
                                        withBorder=True,
                                    ),
                                ],
                            )
                        ],
                    ),
                ],
                gutter="xl",
            ),
        ],
        gap="xl",
        p="lg",
    )
