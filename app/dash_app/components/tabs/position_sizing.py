from __future__ import annotations

import dash_mantine_components as dmc
from dash import html, dcc
from dash_iconify import DashIconify

from ..common import create_info_tooltip


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
            dmc.Paper(
                p="lg",
                withBorder=True,
                children=[
                    dmc.Stack(
                        gap="md",
                        children=[
                            dmc.Group(
                                [
                                    dmc.Title("Position Sizing Parameters", order=4),
                                    create_info_tooltip(
                                        title="Position Sizing Parameters",
                                        content="Set starting capital, Kelly fraction, and drawdown guardrails. Changes update insights instantly; save to persist.",
                                        detailed_content="Inputs persist per portfolio fingerprint in localStorage, so you can iterate without re-uploading.",
                                        tooltip_id="ps-parameters",
                                    ),
                                ],
                                justify="space-between",
                                align="center",
                            ),
                            dmc.SimpleGrid(
                                cols=3,
                                spacing="lg",
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
                                    ),
                                    dmc.NumberInput(
                                        id="ps-target-drawdown-input",
                                        label="Target Max Drawdown (%)",
                                        description="Comfort zone for peak-to-trough loss",
                                        min=1,
                                        max=100,
                                        step=1,
                                        allowNegative=False,
                                    ),
                                    dmc.NumberInput(
                                        id="ps-kelly-fraction-input",
                                        label="Kelly Fraction (%)",
                                        description="Percent of calculated Kelly you want to apply",
                                        min=0,
                                        max=200,
                                        step=1,
                                        value=100,
                                        allowNegative=False,
                                        suffix="%",
                                    ),
                                ],
                            ),
                            dmc.Group(
                                [
                                    dmc.Text("Quick presets", size="xs", c="dimmed"),
                                    dmc.Group(
                                        gap="xs",
                                        children=[
                                            dmc.Button(
                                                "Full Kelly",
                                                id="ps-fraction-preset-full",
                                                variant="subtle",
                                                size="xs",
                                            ),
                                            dmc.Button(
                                                "Half Kelly",
                                                id="ps-fraction-preset-half",
                                                variant="subtle",
                                                size="xs",
                                            ),
                                            dmc.Button(
                                                "Quarter Kelly",
                                                id="ps-fraction-preset-quarter",
                                                variant="subtle",
                                                size="xs",
                                            ),
                                        ],
                                    ),
                                ],
                                justify="space-between",
                                align="center",
                            ),
                            dmc.Group(
                                [
                                    dmc.Button(
                                        "Save Settings",
                                        id="ps-save-settings",
                                        leftSection=DashIconify(
                                            icon="tabler:device-floppy", width=16
                                        ),
                                        variant="filled",
                                        color="green",
                                        size="md",
                                    ),
                                    dmc.Button(
                                        "Reset",
                                        id="ps-reset-settings",
                                        leftSection=DashIconify(icon="tabler:refresh", width=16),
                                        variant="light",
                                        size="md",
                                    ),
                                    html.Div(id="ps-saved-feedback", style={"marginLeft": "auto"}),
                                ],
                                justify="flex-end",
                                align="center",
                            ),
                        ],
                    )
                ],
            ),
            dmc.Stack(
                gap="lg",
                children=[
                    dmc.Paper(
                        p="lg",
                        withBorder=True,
                        children=[
                            html.Div(id="position-sizing-kelly-analysis"),
                            html.Div(id="position-sizing-fraction-tiles"),
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
                                            dmc.Title("Strategy Overrides", order=4),
                                            create_info_tooltip(
                                                title="Strategy Overrides",
                                                content="Future home for per-strategy sizing adjustments.",
                                                detailed_content="We plan to let you cap contracts or adjust Kelly multipliers for individual strategies while keeping global defaults.",
                                                tooltip_id="ps-strategy-overrides",
                                            ),
                                        ],
                                        justify="space-between",
                                        align="center",
                                    ),
                                    dmc.Alert(
                                        "Strategy-specific sizing controls are coming soon.",
                                        color="gray",
                                        variant="light",
                                    ),
                                ],
                            )
                        ],
                    ),
                    dmc.Paper(
                        p="lg",
                        withBorder=True,
                        children=[
                            dmc.Group(
                                [
                                    dmc.Title("Margin Utilization", order=4),
                                    create_info_tooltip(
                                        title="Margin Utilization",
                                        content="Compare historical margin requirements against your current Kelly fraction.",
                                        detailed_content="We chart margin as a percent of starting capital and overlay Kelly guides for quick comparison.",
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
                    ),
                    dmc.Paper(
                        p="lg",
                        withBorder=True,
                        children=[
                            dmc.Stack(
                                gap="md",
                                children=[
                                    dmc.Title("Roadmap", order=4),
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
                                                "Compare sizing rules side-by-side (fixed fractional, Kelly variants, volatility-based)."
                                            ),
                                            dmc.ListItem(
                                                "Interactive risk-of-ruin analysis with configurable guardrails."
                                            ),
                                            dmc.ListItem(
                                                "Scenario replays that rebuild equity curves with alternative sizing inputs."
                                            ),
                                        ],
                                    ),
                                ],
                            )
                        ],
                    ),
                ],
            ),
        ],
    )
