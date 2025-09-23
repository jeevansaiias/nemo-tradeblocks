"""
🎲 Risk Simulator Tab - Monte Carlo Analysis with Bootstrap Resampling

Advanced risk simulation using historical trade data to project future outcomes.
Features bootstrap resampling to preserve real distribution characteristics.
"""

import dash_mantine_components as dmc
from dash import dcc
from dash_iconify import DashIconify
import plotly.graph_objects as go

from ..common import create_info_tooltip


# Import placeholder chart functions
def create_placeholder_equity_curve():
    """Create a placeholder equity curve chart"""
    import numpy as np
    import plotly.graph_objects as go

    days = np.arange(0, 252)
    np.random.seed(42)
    median_path = 100000 * (1 + 0.0003 * days + 0.001 * np.random.randn(len(days)).cumsum())

    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=days,
            y=median_path,
            mode="lines",
            name="Example Projection",
            line=dict(color="gray", dash="dash"),
        )
    )

    fig.update_layout(
        xaxis_title="Days Forward",
        yaxis_title="Portfolio Value ($)",
        annotations=[
            dict(
                text="Upload portfolio data and click 'Run Simulation' to see projections",
                xref="paper",
                yref="paper",
                x=0.5,
                y=0.5,
                xanchor="center",
                yanchor="middle",
                font=dict(size=14, color="gray"),
                showarrow=False,
            )
        ],
        showlegend=False,
    )
    return fig


def create_placeholder_histogram():
    """Create a placeholder histogram"""
    import numpy as np
    import plotly.graph_objects as go

    data = np.random.normal(0.05, 0.15, 100)

    fig = go.Figure(
        data=[
            go.Histogram(
                x=data,
                nbinsx=20,
                marker_color="rgba(128,128,128,0.5)",
                marker_line_color="rgba(128,128,128,1)",
                marker_line_width=1,
            )
        ]
    )

    fig.update_layout(
        xaxis_title="Return",
        yaxis_title="Frequency",
        showlegend=False,
        annotations=[
            dict(
                text="Click 'Run Simulation' to analyze your data",
                xref="paper",
                yref="paper",
                x=0.5,
                y=0.8,
                xanchor="center",
                yanchor="middle",
                font=dict(size=14, color="gray"),
                showarrow=False,
            )
        ],
    )
    return fig


def create_risk_simulator_tab():
    """Create the Risk Simulator tab with Monte Carlo controls"""
    return dmc.Stack(
        children=[
            # Store for cached simulation results
            dcc.Store(id="mc-simulation-cache", storage_type="memory"),
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
                    *create_statistics_grid(),  # Unpack the list of grids
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
                    dmc.Group(
                        [
                            dmc.Text("Simulation Parameters", size="lg", fw=600),
                            create_info_tooltip(
                                title="🧱 Monte Carlo Risk Simulator",
                                content="Build thousands of possible futures from your trading blocks. Each simulation reshuffles your actual trade results to show what could happen next.",
                                detailed_content="TradeBlocks builds insights, not investment advice. Use these projections to understand your risk, not predict the future.",
                            ),
                        ],
                        gap="xs",
                    ),
                    dmc.Grid(
                        [
                            # Left column - Main controls
                            dmc.GridCol(
                                [
                                    dmc.Stack(
                                        [
                                            # Number of simulations
                                            dmc.Stack(
                                                [
                                                    dmc.Group(
                                                        [
                                                            dmc.Text(
                                                                "Number of Simulations",
                                                                size="sm",
                                                                fw=500,
                                                            ),
                                                            create_info_tooltip(
                                                                title="🧱 Simulation Count",
                                                                content="How many different ways to stack your trading blocks. More simulations = smoother probability curves and more reliable percentiles.",
                                                                detailed_content="1,000 simulations work for quick insights. 10,000 for presentation-quality analysis. The blocks don't change, just how we arrange them.",
                                                            ),
                                                        ],
                                                        gap="xs",
                                                    ),
                                                    dmc.NumberInput(
                                                        id="mc-num-simulations",
                                                        description="More simulations = better accuracy",
                                                        value=1000,
                                                        min=100,
                                                        max=10000,
                                                        step=100,
                                                        leftSection=DashIconify(
                                                            icon="tabler:refresh", width=16
                                                        ),
                                                    ),
                                                ],
                                                gap="xs",
                                            ),
                                            # Time horizon
                                            dmc.Stack(
                                                [
                                                    dmc.Group(
                                                        [
                                                            dmc.Text(
                                                                "Simulation Length",
                                                                size="sm",
                                                                fw=500,
                                                            ),
                                                            create_info_tooltip(
                                                                title="🧱 Time Horizon",
                                                                content="How many trades into the future to project. Not calendar days - actual trades based on your historical frequency.",
                                                                detailed_content="252 trades ≈ 1 year for daily traders. Choose based on your planning horizon. Longer projections have wider uncertainty bands - that's math, not pessimism.",
                                                            ),
                                                        ],
                                                        gap="xs",
                                                    ),
                                                    dmc.Select(
                                                        id="mc-time-horizon",
                                                        description="Number of trades to simulate",
                                                        data=[
                                                            {"value": "30", "label": "30 Trades"},
                                                            {"value": "60", "label": "60 Trades"},
                                                            {"value": "90", "label": "90 Trades"},
                                                            {"value": "180", "label": "180 Trades"},
                                                            {
                                                                "value": "252",
                                                                "label": "252 Trades (~1 Year)",
                                                            },
                                                            {
                                                                "value": "504",
                                                                "label": "504 Trades (~2 Years)",
                                                            },
                                                        ],
                                                        value="252",
                                                        leftSection=DashIconify(
                                                            icon="tabler:calendar", width=16
                                                        ),
                                                    ),
                                                ],
                                                gap="xs",
                                            ),
                                        ],
                                        gap="md",
                                    )
                                ],
                                span=4,
                            ),
                            # Right column - Strategy and capital
                            dmc.GridCol(
                                [
                                    dmc.Stack(
                                        [
                                            # Strategy selector (consistent with other screens)
                                            dmc.Stack(
                                                [
                                                    dmc.Group(
                                                        [
                                                            dmc.Text("Strategy", size="sm", fw=500),
                                                            create_info_tooltip(
                                                                title="🧱 Strategy Selection",
                                                                content="Choose which trading blocks to shuffle. 'All Strategies' shows portfolio-level risk. Individual strategies reveal concentrated risks.",
                                                                detailed_content="Different strategies = different colored blocks. Mix them for diversification insights, or isolate them to spot weaknesses.",
                                                            ),
                                                        ],
                                                        gap="xs",
                                                    ),
                                                    dmc.Select(
                                                        id="mc-strategy-selection",
                                                        description="Strategy to simulate",
                                                        value="all",
                                                        data=[
                                                            {
                                                                "value": "all",
                                                                "label": "All Strategies",
                                                            }
                                                        ],
                                                        leftSection=DashIconify(
                                                            icon="tabler:chart-line", width=16
                                                        ),
                                                    ),
                                                ],
                                                gap="xs",
                                            ),
                                            # Initial capital
                                            dmc.Stack(
                                                [
                                                    dmc.Group(
                                                        [
                                                            dmc.Text(
                                                                "Initial Capital ($)",
                                                                size="sm",
                                                                fw=500,
                                                            ),
                                                            create_info_tooltip(
                                                                title="🧱 Starting Capital",
                                                                content="Your foundation block - the base from which all simulations begin. Auto-filled from your data, but adjustable for what-if scenarios.",
                                                                detailed_content="Test different account sizes to see if your strategy scales. Percentage returns should stay similar; dollar returns will vary.",
                                                            ),
                                                        ],
                                                        gap="xs",
                                                    ),
                                                    dmc.NumberInput(
                                                        id="mc-initial-capital",
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
                                                gap="xs",
                                            ),
                                        ],
                                        gap="md",
                                    )
                                ],
                                span=8,
                            ),
                        ],
                        gutter="xl",
                    ),
                    # Advanced options section
                    dmc.Accordion(
                        children=[
                            dmc.AccordionItem(
                                value="advanced",
                                children=[
                                    dmc.AccordionControl(
                                        "Advanced Settings",
                                        icon=DashIconify(icon="tabler:settings", width=16),
                                    ),
                                    dmc.AccordionPanel(
                                        dmc.Stack(
                                            [
                                                # Trades per year
                                                dmc.Stack(
                                                    [
                                                        dmc.Group(
                                                            [
                                                                dmc.Text(
                                                                    "Trades Per Year",
                                                                    size="sm",
                                                                    fw=500,
                                                                ),
                                                                create_info_tooltip(
                                                                    title="🧱 Annual Trade Frequency",
                                                                    content="Your block-stacking speed. How many trades you complete in a typical year - critical for annualizing returns correctly.",
                                                                    detailed_content="Day traders: 200-500+. Swing traders: 50-200. Position traders: 20-50. Wrong frequency = misleading annual returns.",
                                                                ),
                                                            ],
                                                            gap="xs",
                                                        ),
                                                        dmc.NumberInput(
                                                            id="mc-trades-per-year",
                                                            description="For annualization",
                                                            value=125,
                                                            min=10,
                                                            max=1000,
                                                            step=25,
                                                            style={"width": 200},
                                                        ),
                                                    ],
                                                    gap="xs",
                                                ),
                                                # Sampling method
                                                dmc.Stack(
                                                    [
                                                        dmc.Group(
                                                            [
                                                                dmc.Text(
                                                                    "Sampling Method",
                                                                    size="sm",
                                                                    fw=500,
                                                                ),
                                                                create_info_tooltip(
                                                                    title="🧱 Sampling Method",
                                                                    content="Individual Trades: Each block is a single trade P&L. Daily Returns: Blocks are daily totals. Your choice depends on trading style.",
                                                                    detailed_content="Multiple trades per day? Use Daily. One trade at a time? Use Individual. This preserves the true 'chunkiness' of your returns.",
                                                                ),
                                                            ],
                                                            gap="xs",
                                                        ),
                                                        dmc.RadioGroup(
                                                            id="mc-bootstrap-method",
                                                            value="trades",
                                                            children=dmc.Group(
                                                                [
                                                                    dmc.Radio(
                                                                        "Individual Trades",
                                                                        value="trades",
                                                                    ),
                                                                    dmc.Radio(
                                                                        "Daily Returns",
                                                                        value="daily",
                                                                    ),
                                                                ],
                                                                gap="md",
                                                            ),
                                                        ),
                                                    ],
                                                    gap="xs",
                                                ),
                                                # Random seed
                                                dmc.Stack(
                                                    [
                                                        dmc.Group(
                                                            [
                                                                dmc.Text(
                                                                    "Random Seed", size="sm", fw=500
                                                                ),
                                                                create_info_tooltip(
                                                                    title="🧱 Random Seed Control",
                                                                    content="Like a blueprint number for your block arrangements. Same seed = same results every time. Essential for comparing scenarios.",
                                                                    detailed_content="Fixed seed (42 is traditional) for reproducible analysis. Random seed to explore the full uncertainty space. Both are valid insights.",
                                                                ),
                                                            ],
                                                            gap="xs",
                                                        ),
                                                        dmc.Group(
                                                            [
                                                                dmc.Switch(
                                                                    id="mc-use-random-seed",
                                                                    label="Use Fixed",
                                                                    checked=True,
                                                                    size="sm",
                                                                ),
                                                                dmc.NumberInput(
                                                                    id="mc-seed-value",
                                                                    placeholder="Seed",
                                                                    value=42,
                                                                    min=0,
                                                                    max=999999,
                                                                    step=1,
                                                                    style={"width": 100},
                                                                    size="sm",
                                                                    disabled=False,
                                                                ),
                                                            ],
                                                            align="center",
                                                            gap="sm",
                                                        ),
                                                    ],
                                                    gap="xs",
                                                ),
                                            ],
                                            gap="md",
                                        ),
                                    ),
                                ],
                            )
                        ],
                        variant="separated",
                    ),
                    # Run Simulation Button
                    dmc.Group(
                        [
                            dmc.Button(
                                "Run Simulation",
                                id="mc-run-simulation",
                                leftSection=DashIconify(icon="tabler:player-play", width=16),
                                variant="filled",
                                size="md",
                                color="green",
                            ),
                            dmc.Button(
                                "Reset",
                                id="mc-reset",
                                leftSection=DashIconify(icon="tabler:refresh", width=16),
                                variant="light",
                                size="md",
                            ),
                        ],
                        justify="center",
                        gap="md",
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
                                    dmc.SegmentedControl(
                                        id="mc-scale-selector",
                                        value="linear",
                                        data=[
                                            {"value": "linear", "label": "Linear"},
                                            {"value": "log", "label": "Log"},
                                        ],
                                        size="sm",
                                    ),
                                    dmc.Switch(
                                        id="mc-show-paths",
                                        label="Show Individual Paths",
                                        size="sm",
                                        checked=False,
                                    ),
                                ],
                                gap="md",
                                align="center",
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
                        figure=create_placeholder_equity_curve(),
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
    return [
        # First row - main metrics
        dmc.SimpleGrid(
            cols=4,
            spacing="md",
            children=[
                create_stat_card(
                    title="Expected Return",
                    value_id="mc-expected-return",
                    subtitle_id="mc-expected-return-desc",
                    icon="tabler:trending-up",
                    color="green",
                    tooltip_title="🧱 Expected Return",
                    tooltip_content="The average outcome across all simulations. Your 'center of gravity' if you keep trading with these blocks.",
                    tooltip_detail="Not a guarantee - it's the mathematical average. Half of outcomes will be better, half worse. That's the nature of probability.",
                ),
                create_stat_card(
                    title="Value at Risk (95%)",
                    value_id="mc-var-95",
                    subtitle_id="mc-var-95-desc",
                    icon="tabler:alert-triangle",
                    color="red",
                    tooltip_title="🧱 Value at Risk (VaR)",
                    tooltip_content="Your risk floor - the return level that 95% of simulations stayed above. Only 5% of outcomes were worse than this number.",
                    tooltip_detail="Positive VaR (e.g., +19.7%) = Even your worst 5% scenarios are profitable! Negative VaR (e.g., -8.5%) = 5% chance of losing more than 8.5%.",
                ),
                create_stat_card(
                    title="Probability of Profit",
                    value_id="mc-prob-profit",
                    subtitle_id="mc-prob-profit-desc",
                    icon="tabler:percentage",
                    color="blue",
                    tooltip_title="🧱 Win Probability",
                    tooltip_content="What percentage of simulated futures end in profit? Your odds of success if the future resembles the past.",
                    tooltip_detail="Based on reshuffling your actual trades. High probability doesn't mean guaranteed profit - it means consistent positive edge.",
                ),
                create_stat_card(
                    title="Max Drawdown (95th)",
                    value_id="mc-max-drawdown",
                    subtitle_id="mc-max-drawdown-desc",
                    icon="tabler:chart-line",
                    color="orange",
                    tooltip_title="🧱 Maximum Drawdown",
                    tooltip_content="The deepest valley in 95% of simulations. How far your blocks might tumble before recovering.",
                    tooltip_detail="95th percentile worst drawdown - only 5% of simulations had deeper drops. Essential for position sizing and psychology.",
                ),
            ],
        ),
        # Second row - scenario metrics
        dmc.SimpleGrid(
            cols=3,
            spacing="md",
            children=[
                create_stat_card(
                    title="Best Case (95th)",
                    value_id="mc-best-case",
                    subtitle_id="mc-best-case-desc",
                    icon="tabler:star",
                    color="green",
                    tooltip_title="🧱 Best Case Scenario",
                    tooltip_content="The 95th percentile outcome. Only 5% of simulations exceeded this return.",
                    tooltip_detail="Your upside potential if things go really well. Not a prediction, but a boundary of possibility based on your trading blocks.",
                ),
                create_stat_card(
                    title="Most Likely (50th)",
                    value_id="mc-median-case",
                    subtitle_id="mc-median-case-desc",
                    icon="tabler:target",
                    color="blue",
                    tooltip_title="🧱 Most Likely Outcome",
                    tooltip_content="The median result. Half of simulations were above this, half below.",
                    tooltip_detail="This is your 'center line' - if your future trades perform like your past trades, you'll land near here.",
                ),
                create_stat_card(
                    title="Worst Case (5th)",
                    value_id="mc-worst-case",
                    subtitle_id="mc-worst-case-desc",
                    icon="tabler:alert-triangle",
                    color="orange",
                    tooltip_title="🧱 Worst Case Scenario",
                    tooltip_content="The 5th percentile outcome. 95% of simulations stayed above this level.",
                    tooltip_detail="Your downside risk if things go poorly. Plan your position sizing and risk management around surviving this scenario.",
                ),
            ],
        ),
    ]


def create_stat_card(
    title,
    value_id,
    subtitle_id,
    icon,
    color,
    tooltip_title=None,
    tooltip_content=None,
    tooltip_detail=None,
):
    """Create a statistic card with optional tooltip"""
    return dmc.Paper(
        children=[
            dmc.Stack(
                [
                    dmc.Group(
                        [
                            DashIconify(icon=icon, width=20, color=color),
                            dmc.Text(title, size="sm", c="dimmed"),
                            (
                                create_info_tooltip(
                                    title=tooltip_title,
                                    content=tooltip_content,
                                    detailed_content=tooltip_detail,
                                )
                                if tooltip_title
                                else None
                            ),
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
                            dmc.TabsTab(
                                dmc.Group(
                                    [
                                        DashIconify(icon="tabler:chart-histogram", width=16),
                                        "Return Distribution",
                                        create_info_tooltip(
                                            title="📊 Return Distribution Analysis",
                                            content="Shows the spread of potential returns from your Monte Carlo simulation. The histogram reveals how likely different outcomes are.",
                                            detailed_content="P5/P50/P95 lines show pessimistic, median, and optimistic scenarios. A wider spread means higher uncertainty. TradeBlocks builds insights, not investment advice.",
                                            tooltip_id="return-distribution",
                                        ),
                                    ],
                                    gap="xs",
                                ),
                                value="distribution",
                            ),
                            dmc.TabsTab(
                                dmc.Group(
                                    [
                                        DashIconify(icon="tabler:trending-down", width=16),
                                        "Drawdown Analysis",
                                        create_info_tooltip(
                                            title="📉 Drawdown Analysis",
                                            content="Shows the distribution of maximum drawdowns from your simulations. Helps you understand worst-case scenarios and prepare for losing streaks.",
                                            detailed_content="Each simulation's worst drawdown is captured. P5 shows the worst 5% of outcomes. Use this to size your account and manage risk. TradeBlocks builds insights, not investment advice.",
                                            tooltip_id="drawdown-analysis",
                                        ),
                                    ],
                                    gap="xs",
                                ),
                                value="drawdown",
                            ),
                        ]
                    ),
                    # Distribution Tab
                    dmc.TabsPanel(
                        children=[
                            dcc.Graph(
                                id="mc-return-distribution",
                                config={"displayModeBar": False, "responsive": True},
                                style={"height": "60vh", "minHeight": "400px"},
                                figure=create_placeholder_histogram(),
                            )
                        ],
                        value="distribution",
                    ),
                    # Drawdown Tab
                    dmc.TabsPanel(
                        children=[
                            dcc.Graph(
                                id="mc-drawdown-analysis",
                                config={"displayModeBar": False, "responsive": True},
                                style={"height": "60vh", "minHeight": "400px"},
                                figure=create_placeholder_histogram(),
                            )
                        ],
                        value="drawdown",
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


def create_preview_chart(chart_type):
    """Create an informative preview chart showing what users will see"""
    fig = go.Figure()

    if chart_type == "distribution":
        # Create a preview histogram shape
        preview_annotations = [
            dict(
                text="📊 Return Distribution Preview",
                xref="paper",
                yref="paper",
                x=0.5,
                y=0.85,
                xanchor="center",
                yanchor="middle",
                font=dict(size=18, color="#1976d2", weight="bold"),
                showarrow=False,
            ),
            dict(
                text="Your simulation will show:",
                xref="paper",
                yref="paper",
                x=0.5,
                y=0.7,
                xanchor="center",
                yanchor="middle",
                font=dict(size=14, color="gray"),
                showarrow=False,
            ),
            dict(
                text="• Histogram of potential returns<br>• P5, P50, P95 percentile lines<br>• Risk/reward distribution<br>• Outcome probability ranges",
                xref="paper",
                yref="paper",
                x=0.5,
                y=0.5,
                xanchor="center",
                yanchor="middle",
                font=dict(size=13, color="#333"),
                showarrow=False,
            ),
            dict(
                text="🚀 Run simulation above to see your results",
                xref="paper",
                yref="paper",
                x=0.5,
                y=0.25,
                xanchor="center",
                yanchor="middle",
                font=dict(size=14, color="#1976d2"),
                showarrow=False,
            ),
        ]
    elif chart_type == "drawdown":
        preview_annotations = [
            dict(
                text="📉 Drawdown Analysis Preview",
                xref="paper",
                yref="paper",
                x=0.5,
                y=0.85,
                xanchor="center",
                yanchor="middle",
                font=dict(size=18, color="#1976d2", weight="bold"),
                showarrow=False,
            ),
            dict(
                text="Your simulation will show:",
                xref="paper",
                yref="paper",
                x=0.5,
                y=0.7,
                xanchor="center",
                yanchor="middle",
                font=dict(size=14, color="gray"),
                showarrow=False,
            ),
            dict(
                text="• Maximum drawdown distribution<br>• Worst-case scenario planning<br>• Risk tolerance insights<br>• Account sizing guidance",
                xref="paper",
                yref="paper",
                x=0.5,
                y=0.5,
                xanchor="center",
                yanchor="middle",
                font=dict(size=13, color="#333"),
                showarrow=False,
            ),
            dict(
                text="🚀 Run simulation above to see your results",
                xref="paper",
                yref="paper",
                x=0.5,
                y=0.25,
                xanchor="center",
                yanchor="middle",
                font=dict(size=14, color="#1976d2"),
                showarrow=False,
            ),
        ]

    fig.update_layout(
        xaxis=dict(showgrid=False, showticklabels=False, zeroline=False),
        yaxis=dict(showgrid=False, showticklabels=False, zeroline=False),
        annotations=preview_annotations,
        plot_bgcolor="rgba(0,0,0,0)",
        paper_bgcolor="rgba(0,0,0,0)",
        margin=dict(t=20, b=20, l=20, r=20),
    )

    return fig
