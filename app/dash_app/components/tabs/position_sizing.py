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
                                                title="Position Sizing & Kelly Allocation",
                                                content="Set your capital base and Kelly fractions to build an optimal allocation plan.",
                                                detailed_content="Adjust starting capital and Kelly percentages, then run the allocation to see portfolio and strategy metrics.",
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
                                            dmc.Group(
                                                gap="md",
                                                grow=True,
                                                children=[
                                                    dmc.NumberInput(
                                                        id="ps-starting-capital-input",
                                                        label="Starting Capital ($)",
                                                        description="Net liquidity or capital base",
                                                        min=0,
                                                        step=1000,
                                                        allowNegative=False,
                                                        prefix="$ ",
                                                        thousandSeparator=",",
                                                        style={"flex": 1},
                                                    ),
                                                    dmc.NumberInput(
                                                        id="ps-kelly-fraction-input",
                                                        label="Portfolio Kelly Fraction (%)",
                                                        description="Percent of Kelly to apply globally",
                                                        min=0,
                                                        max=200,
                                                        step=1,
                                                        value=100,
                                                        allowNegative=False,
                                                        suffix="%",
                                                        style={"flex": 1},
                                                    ),
                                                ],
                                            ),
                                            dmc.Button(
                                                "Apply to All Strategies",
                                                id="ps-apply-portfolio-kelly",
                                                leftSection=DashIconify(
                                                    icon="tabler:arrow-down", width=16
                                                ),
                                                variant="light",
                                                color="teal",
                                                fullWidth=True,
                                            ),
                                        ],
                                    ),
                                    dmc.Stack(
                                        gap="xs",
                                        children=[
                                            dmc.Text(
                                                "Adjust the Kelly multiplier for each strategy individually:",
                                                size="sm",
                                                c="dimmed",
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
                                    html.Div(id="ps-portfolio-kelly-summary"),
                                    html.Div(id="ps-strategy-results"),
                                ],
                            )
                        ],
                    ),
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
                                                title="Margin Utilization",
                                                content="Visualize margin needs for the portfolio and each strategy.",
                                                detailed_content="We chart margin as a percent of starting capital for the combined portfolio and overlay each strategy's historical usage.",
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
