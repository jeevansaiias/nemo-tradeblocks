from __future__ import annotations

import dash_mantine_components as dmc
from dash import html, dcc
from dash_iconify import DashIconify

from ..common import create_info_tooltip
from app.utils.placeholders import create_placeholder_figure


def create_position_sizing_tab():
    """Create the Position Sizing tab with settings-first workflow."""

    return dmc.Stack(
        gap="xl",
        p="lg",
        children=[
            dmc.Stack(
                gap="xs",
                children=[
                    dmc.Title("🎯 Position Sizing Analysis", order=2),
                    dmc.Text(
                        "Tune position sizing with portfolio-aware recommendations saved locally for quick iteration.",
                        size="sm",
                        c="dimmed",
                    ),
                ],
            ),
            dmc.Stack(
                gap="lg",
                children=[
                    dmc.Paper(
                        p="lg",
                        withBorder=True,
                        children=[
                            dmc.Stack(
                                gap="lg",
                                children=[
                                    dmc.Group(
                                        [
                                            dmc.Title(
                                                "Position Sizing & Kelly Allocation", order=4
                                            ),
                                            create_info_tooltip(
                                                title="📊 Position Sizing & Kelly Allocation",
                                                content="Transform your trading edge into optimal position sizes. The Kelly criterion mathematically determines how much capital to risk based on your win rate and payoff ratio.",
                                                detailed_content="Most professional traders use 10-25% of full Kelly to reduce volatility. Your historical trades reveal each strategy's optimal size—this tool helps you scale them appropriately.",
                                                tooltip_id="ps-kelly-allocation",
                                            ),
                                        ],
                                        justify="space-between",
                                        align="center",
                                    ),
                                    dmc.Stack(
                                        gap="md",
                                        mb="lg",
                                        children=[
                                            dmc.Stack(
                                                gap="md",
                                                children=[
                                                    dmc.Group(
                                                        gap="md",
                                                        grow=True,
                                                        children=[
                                                            dmc.Stack(
                                                                gap="xs",
                                                                style={"flex": 1},
                                                                children=[
                                                                    dmc.Group(
                                                                        [
                                                                            dmc.Text(
                                                                                "Starting Capital ($)",
                                                                                size="sm",
                                                                                fw=500,
                                                                            ),
                                                                            create_info_tooltip(
                                                                                title="💰 Starting Capital",
                                                                                content="Your account size or available trading capital. This becomes the denominator for all percentage calculations.",
                                                                                detailed_content="Kelly sizing scales linearly with capital—doubling your account doubles position sizes. The calculations assume this entire amount is available for trading.",
                                                                                tooltip_id="ps-starting-capital",
                                                                            ),
                                                                        ],
                                                                        gap="xs",
                                                                    ),
                                                                    dmc.NumberInput(
                                                                        id="ps-starting-capital-input",
                                                                        description="Net liquidity or capital base",
                                                                        min=0,
                                                                        step=1000,
                                                                        allowNegative=False,
                                                                        prefix="$ ",
                                                                        thousandSeparator=",",
                                                                        w="100%",
                                                                    ),
                                                                ],
                                                            ),
                                                            dmc.Stack(
                                                                gap="xs",
                                                                style={"flex": 1},
                                                                children=[
                                                                    dmc.Group(
                                                                        [
                                                                            dmc.Text(
                                                                                "Portfolio Kelly Fraction (%)",
                                                                                size="sm",
                                                                                fw=500,
                                                                            ),
                                                                            create_info_tooltip(
                                                                                title="🎯 Portfolio Kelly Fraction",
                                                                                content="Your risk dial. At 100%, you're using full Kelly sizing. At 25%, you're trading quarter Kelly—which reduces volatility.",
                                                                                detailed_content="Full Kelly targets maximum geometric growth rate but produces high volatility. Fractional Kelly reduces both expected returns and volatility proportionally—the tradeoff depends on individual risk tolerance.",
                                                                                tooltip_id="ps-portfolio-kelly",
                                                                            ),
                                                                        ],
                                                                        gap="xs",
                                                                    ),
                                                                    dmc.Group(
                                                                        [
                                                                            dmc.NumberInput(
                                                                                id="ps-kelly-fraction-input",
                                                                                description="Percent of Kelly to apply globally",
                                                                                min=0,
                                                                                max=200,
                                                                                step=1,
                                                                                value=100,
                                                                                allowNegative=False,
                                                                                suffix="%",
                                                                                style={"flex": 1},
                                                                            ),
                                                                            dmc.Button(
                                                                                "Apply to All",
                                                                                id="ps-apply-kelly-inline",
                                                                                leftSection=DashIconify(
                                                                                    icon="tabler:arrow-down",
                                                                                    width=14,
                                                                                ),
                                                                                variant="light",
                                                                                color="teal",
                                                                                size="sm",
                                                                            ),
                                                                        ],
                                                                        gap="xs",
                                                                        align="flex-end",
                                                                    ),
                                                                ],
                                                            ),
                                                        ],
                                                    ),
                                                    dmc.Group(
                                                        [
                                                            dmc.Text(
                                                                "Margin Calculation:",
                                                                size="sm",
                                                                fw=500,
                                                            ),
                                                            dmc.SegmentedControl(
                                                                id="ps-margin-calc-mode",
                                                                value="fixed",
                                                                data=[
                                                                    {
                                                                        "value": "fixed",
                                                                        "label": "Fixed Capital",
                                                                    },
                                                                    {
                                                                        "value": "compounding",
                                                                        "label": "Compounding Returns",
                                                                    },
                                                                ],
                                                                size="xs",
                                                            ),
                                                            create_info_tooltip(
                                                                title="📊 Margin Calculation Mode",
                                                                content="Choose how margin percentages are calculated relative to your capital base.",
                                                                detailed_content="Fixed Capital assumes constant position sizing using initial capital as the denominator. Compounding Returns accounts for P&L changes, using the running net liquidity when each trade was opened.",
                                                                tooltip_id="ps-margin-calc-mode-info",
                                                            ),
                                                        ],
                                                        gap="sm",
                                                        align="center",
                                                    ),
                                                ],
                                            ),
                                            # Hidden button for callback registration
                                            html.Div(
                                                id="ps-apply-portfolio-kelly",
                                                style={"display": "none"},
                                            ),
                                        ],
                                    ),
                                    dmc.Stack(
                                        gap="xs",
                                        children=[
                                            dmc.Group(
                                                [
                                                    dmc.Text(
                                                        "Adjust the Kelly multiplier for each strategy individually:",
                                                        size="sm",
                                                        c="dimmed",
                                                    ),
                                                    create_info_tooltip(
                                                        title="🎮 Strategy-Level Control",
                                                        content="Fine-tune each strategy's risk independently. Strategies with different characteristics may warrant different Kelly fractions.",
                                                        detailed_content="Different Kelly fractions let you express varying confidence levels across strategies. Strategy correlation affects total portfolio risk—uncorrelated strategies contribute less to overall volatility than correlated ones.",
                                                        tooltip_id="ps-strategy-kelly",
                                                    ),
                                                ],
                                                gap="xs",
                                            ),
                                            html.Div(id="ps-strategy-action-feedback"),
                                        ],
                                    ),
                                    html.Div(
                                        id="ps-strategy-input-grid",
                                        children=dmc.Alert(
                                            "Upload a portfolio to configure strategy sizing.",
                                            color="gray",
                                            variant="light",
                                        ),
                                    ),
                                    dmc.Group(
                                        [
                                            dmc.Button(
                                                "Run Allocation",
                                                id="ps-run-strategy-analysis",
                                                leftSection=DashIconify(
                                                    icon="tabler:calculator", width=16
                                                ),
                                                variant="filled",
                                                color="blue",
                                                size="md",
                                            ),
                                        ],
                                        justify="flex-start",
                                        align="center",
                                    ),
                                ],
                            )
                        ],
                    ),
                    dmc.Space(h="sm"),
                    dmc.Paper(
                        p="lg",
                        withBorder=True,
                        children=[
                            dmc.Stack(
                                gap="md",
                                children=[
                                    html.Div(id="ps-portfolio-kelly-summary"),
                                    html.Div(id="ps-strategy-results"),
                                ],
                            )
                        ],
                    ),
                    dmc.Space(h="sm"),
                    dmc.Paper(
                        p="lg",
                        withBorder=True,
                        children=[
                            dmc.Stack(
                                gap="md",
                                children=[
                                    dmc.Group(
                                        [
                                            dmc.Title("Margin Utilization", order=4),
                                            create_info_tooltip(
                                                title="📈 Margin Utilization",
                                                content="Track how much buying power each strategy consumes. This chart shows historical margin requirements scaled by your Kelly settings.",
                                                detailed_content="Margin spikes indicate periods when multiple strategies held positions simultaneously. Margin requirements scale linearly with Kelly percentage—halving Kelly halves expected margin usage.",
                                                tooltip_id="ps-margin-utilization",
                                            ),
                                        ],
                                        justify="space-between",
                                        align="center",
                                    ),
                                    dcc.Loading(
                                        dcc.Graph(
                                            id="ps-strategy-margin-chart",
                                            config={"displayModeBar": False},
                                            style={"height": "320px"},
                                            figure=create_placeholder_figure(
                                                "Run Allocation to see margin utilization",
                                                font_size=14,
                                            ),
                                        ),
                                        type="default",
                                    ),
                                    html.Div(id="ps-strategy-margin-warning"),
                                ],
                            )
                        ],
                    ),
                ],
            ),
        ],
    )
