import dash_mantine_components as dmc
from dash import html, dcc
from dash_iconify import DashIconify
import plotly.graph_objects as go
import plotly.express as px


def create_info_tooltip(tooltip_id, title, content, detailed_content=None):
    """Create an info icon with popover tooltip for charts and metrics"""
    return dmc.HoverCard(
        width=300,
        shadow="md",
        position="bottom",
        withArrow=True,
        children=[
            dmc.HoverCardTarget(
                dmc.ActionIcon(
                    DashIconify(icon="tabler:info-circle", width=16),
                    size="sm",
                    variant="subtle",
                    color="gray",
                    id=f"{tooltip_id}-info",
                )
            ),
            dmc.HoverCardDropdown(
                children=[
                    dmc.Stack(
                        [
                            dmc.Text(title, fw=600, size="sm", c="blue"),
                            dmc.Text(content, size="sm"),
                            dmc.Divider() if detailed_content else None,
                            (
                                dmc.Text(detailed_content, size="xs", c="dimmed")
                                if detailed_content
                                else None
                            ),
                        ],
                        gap="xs",
                    )
                ]
            ),
        ],
    )


def create_geekistics_tab():
    """Create the Geekistics tab with comprehensive portfolio statistics"""
    return dmc.Stack(
        children=[
            # Header with title and controls
            dmc.Group(
                children=[
                    # Title with icon
                    dmc.Group(
                        children=[
                            dmc.Title("🧱 Block Stats & Analytics", order=2),
                        ],
                        gap="sm",
                        align="center",
                    ),
                    # Controls
                    dmc.Group(
                        children=[
                            # Strategy Filter
                            dmc.MultiSelect(
                                id="geekistics-strategy-filter",
                                label="Strategies",
                                placeholder="All strategies",
                                data=[],
                                value=[],
                                style={"minWidth": "250px", "maxWidth": "400px"},
                                leftSection=DashIconify(icon="tabler:filter"),
                                clearable=True,
                                searchable=True,
                                maxDropdownHeight=200,
                                maxValues=3,  # Show max 3 pills, then "+X more"
                            ),
                        ],
                        gap="md",
                        wrap="wrap",
                    ),
                ],
                justify="space-between",
                align="flex-end",
                mb="lg",
            ),
            # All stats content will be populated by callback
            html.Div(id="geekistics-content"),
        ],
        gap="lg",
    )


def create_metric_card(title, value, subtitle=None, icon=None, color="gray"):
    """Create a metric card component"""
    return dmc.Paper(
        children=[
            dmc.Group(
                children=[
                    dmc.Stack(
                        children=[
                            dmc.Text(title, size="sm", c="dimmed"),
                            dmc.Text(str(value), size="xl", fw=700, c=color),
                            dmc.Text(subtitle, size="xs", c="dimmed") if subtitle else None,
                        ],
                        gap="xs",
                        style={"flex": 1},
                    ),
                    (
                        DashIconify(
                            icon=icon or "tabler:chart-line", width=32, height=32, color=color
                        )
                        if icon
                        else None
                    ),
                ],
                justify="space-between",
                align="flex-start",
            )
        ],
        p="md",
        withBorder=True,
        radius="md",
    )


def create_comprehensive_stats(
    portfolio_stats, strategy_stats, trades_data, selected_strategies=None, advanced_stats=None
):
    """Create comprehensive portfolio statistics layout"""
    if not portfolio_stats:
        return dmc.Text("No data available", c="dimmed", ta="center")

    # Calculate additional metrics from trades data
    total_trades = len(trades_data) if trades_data else 0

    # Date range
    if trades_data:
        dates = [trade.get("date_opened") for trade in trades_data if trade.get("date_opened")]
        if dates:
            date_range = f"{min(dates)} to {max(dates)}"
        else:
            date_range = "N/A"
    else:
        date_range = "N/A"

    # Calculate additional metrics
    wins = [trade for trade in trades_data if trade.get("pl", 0) > 0] if trades_data else []
    losses = [trade for trade in trades_data if trade.get("pl", 0) < 0] if trades_data else []

    best_trade = max([trade.get("pl", 0) for trade in trades_data]) if trades_data else 0
    worst_trade = min([trade.get("pl", 0) for trade in trades_data]) if trades_data else 0

    # Use advanced stats if available, otherwise fall back to defaults
    if advanced_stats and advanced_stats.get("return_on_margin"):
        rom_stats = advanced_stats["return_on_margin"]
        avg_return_on_margin = rom_stats.get("avg_return_on_margin", 0)
        worst_trade_pct = rom_stats.get("worst_trade_pct", 0)
        best_trade_pct = rom_stats.get("best_trade_pct", 0)
        std_dev_rom = rom_stats.get("std_dev_rom", 0)
    else:
        avg_return_on_margin = 0.0
        worst_trade_pct = 0.0
        best_trade_pct = 0.0
        std_dev_rom = 0.0

    # Extract other advanced stats
    cagr = advanced_stats.get("cagr", 0) if advanced_stats else 0
    sharpe_ratio = advanced_stats.get("sharpe_ratio", 0) if advanced_stats else 0
    sortino_ratio = advanced_stats.get("sortino_ratio", 0) if advanced_stats else 0
    calmar_ratio = advanced_stats.get("calmar_ratio", 0) if advanced_stats else 0
    time_in_dd = advanced_stats.get("time_in_drawdown", 0) if advanced_stats else 0
    initial_capital = advanced_stats.get("initial_capital", 0) if advanced_stats else 0

    # Win/loss streaks
    streaks = advanced_stats.get("win_loss_streaks", {}) if advanced_stats else {}
    max_win_streak = streaks.get("max_win_streak", 0)
    max_loss_streak = streaks.get("max_loss_streak", 0)

    # Periodic win rates
    periodic_wr = advanced_stats.get("periodic_win_rates", {}) if advanced_stats else {}
    monthly_wr = periodic_wr.get("monthly_win_rate", 0)
    weekly_wr = periodic_wr.get("weekly_win_rate", 0)

    # Kelly criterion
    kelly_criterion = advanced_stats.get("kelly_criterion", 0) if advanced_stats else 0

    return dmc.Stack(
        [
            # Basic Overview Section
            dmc.Stack(
                [
                    dmc.Group(
                        [
                            dmc.Text("📊 Basic Overview", size="lg", fw=600, c="orange.5"),
                        ],
                        justify="flex-start",
                        mb="sm",
                    ),
                    # Date range bar
                    dmc.Paper(
                        [
                            dmc.Group(
                                [
                                    dmc.Text("📅 Trade Period:", size="sm", fw=600, c="dimmed"),
                                    dmc.Text(date_range, size="md", fw=500),
                                ],
                                justify="center",
                                align="center",
                            )
                        ],
                        p="md",
                        withBorder=True,
                        radius="md",
                        mb="sm",
                    ),
                    dmc.SimpleGrid(
                        [
                            create_stat_card(
                                "Number of Trades",
                                f"{total_trades:,}",
                                color="gray",
                                tooltip_content="Building blocks completed - the total foundation you've laid so far.",
                                tooltip_detailed="Total number of trades executed. More trades provide more data for analysis but don't necessarily mean better performance. This number helps contextualize other statistics - win rates from 10 trades are less reliable than from 100 trades.",
                            ),
                            create_stat_card(
                                "Starting Capital",
                                f"${initial_capital:,.0f}",
                                color="gray",
                                tooltip_content="Foundation funds - the base capital you started building with.",
                                tooltip_detailed="The initial account value when trading began. This serves as the baseline for calculating percentage returns and total growth. Essential for understanding the scale of gains and losses relative to your original investment.",
                            ),
                            create_stat_card(
                                "Avg Return on Margin",
                                f"↗ {avg_return_on_margin:.2f}%",
                                color="green",
                                tooltip_content="Building efficiency - how much structure each margin block creates on average.",
                                tooltip_detailed="Average return relative to margin required per trade. This is crucial for margin-based strategies like options trading. Higher values indicate more efficient use of buying power. Values vary significantly by strategy type and market conditions.",
                            ),
                            create_stat_card(
                                "Std Dev of RoM",
                                f"{std_dev_rom:.2f}%",
                                color="orange",
                                tooltip_content="Construction consistency - how much your building efficiency varies between projects.",
                                tooltip_detailed="Standard deviation of Return on Margin shows the variability in your capital efficiency. Lower values indicate more consistent performance, while higher values suggest more volatile results. Helps assess the reliability of your average returns.",
                            ),
                            create_stat_card(
                                "Best Trade",
                                f"↗ {best_trade_pct:.2f}%",
                                color="green",
                                tooltip_content="Biggest building block - your most successful construction project to date.",
                                tooltip_detailed="The highest return on margin achieved in a single trade. This represents your best-case scenario and shows the upside potential of your strategy. Extremely large best trades might indicate either great skill or significant risk-taking.",
                            ),
                            create_stat_card(
                                "Worst Trade",
                                f"↘ {worst_trade_pct:.2f}%",
                                color="red",
                                tooltip_content="Biggest tumble - when your construction project needed the most rebuilding.",
                                tooltip_detailed="The largest loss on margin for a single trade. This represents your worst-case scenario and indicates the downside risk of your strategy. Understanding this helps assess whether your risk management aligns with your tolerance for losses.",
                            ),
                        ],
                        cols=3,
                        spacing="sm",
                    ),
                ],
                gap="xs",
            ),
            # Performance Metrics Section
            dmc.Stack(
                [
                    dmc.Group(
                        [
                            dmc.Text("📈 Return Metrics", size="lg", fw=600, c="orange.5"),
                            dmc.Badge(
                                "Position-Size Dependent", variant="light", color="gray", size="sm"
                            ),
                        ],
                        justify="space-between",
                        align="center",
                        mb="sm",
                    ),
                    dmc.SimpleGrid(
                        [
                            create_stat_card(
                                "Total P/L",
                                f"${portfolio_stats.get('total_pl', 0):,.0f}",
                                color="green" if portfolio_stats.get("total_pl", 0) > 0 else "red",
                                tooltip_content="Net construction value - total profit or loss from all your building projects.",
                                tooltip_detailed="Sum of all trade profits and losses. This is the absolute dollar amount gained or lost from trading activities. While important, it should be considered alongside the capital required to generate these returns.",
                            ),
                            create_stat_card(
                                "CAGR",
                                f"{cagr:.2f}%",
                                color="green" if cagr > 0 else "red",
                                tooltip_content="Annual building rate - how fast your foundation grows each year.",
                                tooltip_detailed="Compound Annual Growth Rate normalizes returns over time, showing the equivalent annual growth rate. This allows comparison across different time periods and strategies. Higher CAGR indicates faster wealth building, but consider it alongside risk metrics.",
                            ),
                            create_stat_card(
                                "Avg RoM",
                                f"{avg_return_on_margin:.2f}%",
                                color="gray",
                                tooltip_content="Standard building efficiency - typical value created per margin block.",
                                tooltip_detailed="Average Return on Margin across all trades. This metric is especially relevant for options and other margin-based strategies, showing how effectively you use borrowed buying power. Compare this to risk-free rates for context.",
                            ),
                            create_stat_card(
                                "Win Rate",
                                f"{portfolio_stats.get('win_rate', 0)*100:.2f}%",
                                color="green",
                                tooltip_content="Building success rate - percentage of projects that added value.",
                                tooltip_detailed="Percentage of trades that were profitable. While higher win rates seem better, they don't tell the whole story. A strategy with 40% win rate but large winners can outperform a 80% win rate strategy with small winners.",
                            ),
                            create_stat_card(
                                "Loss Rate",
                                f"{(1-portfolio_stats.get('win_rate', 0))*100:.2f}%",
                                color="red",
                                tooltip_content="Rebuilding frequency - percentage of projects that required reconstruction.",
                                tooltip_detailed="Percentage of trades that resulted in losses. This is simply the inverse of win rate. Understanding your loss frequency helps set expectations and plan for the psychological impact of inevitable losing trades.",
                            ),
                        ],
                        cols=5,
                        spacing="sm",
                    ),
                ],
                gap="xs",
            ),
            # Risk & Drawdown Section
            dmc.Stack(
                [
                    dmc.Group(
                        [
                            dmc.Text("⚠️ Risk & Drawdown", size="lg", fw=600, c="orange.5"),
                            dmc.Badge(
                                "Position-Size Dependent",
                                variant="light",
                                color="orange",
                                size="sm",
                            ),
                        ],
                        justify="space-between",
                        align="center",
                        mb="sm",
                    ),
                    dmc.SimpleGrid(
                        [
                            create_stat_card(
                                "Max Drawdown",
                                f"{abs(portfolio_stats.get('max_drawdown', 0)):.2f}%",
                                color="red",
                                tooltip_content="Biggest foundation crack - the deepest your structure has sunk.",
                                tooltip_detailed="Maximum percentage decline from a peak to subsequent trough. This represents your worst-case scenario and is crucial for understanding the downside risk of your strategy. Most traders find drawdowns over 20-30% psychologically challenging.",
                            ),
                            create_stat_card(
                                "Time in DD",
                                f"{time_in_dd:.2f}%",
                                color="orange",
                                tooltip_content="Rebuilding time - percentage of time spent repairing foundation damage.",
                                tooltip_detailed="Percentage of time the account was below previous peak values. Long periods in drawdown can be psychologically taxing and may indicate recovery issues. Strategies with quick recovery tend to be more sustainable.",
                            ),
                            create_stat_card(
                                "Sharpe Ratio",
                                f"{sharpe_ratio:.2f}",
                                color="gray",
                                tooltip_content="Risk-adjusted building score - how much extra return per unit of construction risk.",
                                tooltip_detailed="Measures excess return per unit of volatility. Values above 1.0 are considered good, above 2.0 excellent. This helps compare strategies with different risk profiles by normalizing returns for the volatility experienced.",
                            ),
                            create_stat_card(
                                "Sortino Ratio",
                                f"{sortino_ratio:.2f}",
                                color="gray",
                                tooltip_content="Downside-focused building score - return efficiency when accounting only for foundation damage.",
                                tooltip_detailed="Similar to Sharpe ratio but only considers downside volatility, ignoring upside volatility. This provides a more accurate risk assessment since investors typically don't mind positive volatility. Higher values indicate better downside risk management.",
                            ),
                            create_stat_card(
                                "Calmar Ratio",
                                f"{calmar_ratio:.2f}",
                                color="green",
                                tooltip_content="Recovery building rate - annual growth compared to worst foundation damage.",
                                tooltip_detailed="CAGR divided by maximum drawdown. This shows how much annual return you're getting relative to the worst decline experienced. Higher values indicate strategies that generate good returns without severe drawdowns.",
                            ),
                        ],
                        cols=5,
                        spacing="sm",
                    ),
                ],
                gap="xs",
            ),
            # Consistency Metrics Section
            dmc.Stack(
                [
                    dmc.Group(
                        [
                            dmc.Text("🎯 Consistency Metrics", size="lg", fw=600, c="orange.5"),
                            dmc.Badge(
                                "Position-Size Independent",
                                variant="light",
                                color="purple",
                                size="sm",
                            ),
                        ],
                        justify="space-between",
                        align="center",
                        mb="sm",
                    ),
                    dmc.SimpleGrid(
                        [
                            create_stat_card(
                                "Win Streak",
                                f"{max_win_streak}",
                                color="green",
                                tooltip_content="Longest building run - most consecutive successful projects completed.",
                                tooltip_detailed="Maximum number of consecutive winning trades. Long win streaks can indicate good strategy alignment with market conditions, but they can also lead to overconfidence. Understanding your typical streak length helps with psychological preparation.",
                            ),
                            create_stat_card(
                                "Loss Streak",
                                f"{max_loss_streak}",
                                color="red",
                                tooltip_content="Longest rebuilding period - most consecutive projects that needed repairs.",
                                tooltip_detailed="Maximum number of consecutive losing trades. Everyone experiences losing streaks, and knowing your worst helps with risk management and position sizing. Extended loss streaks might indicate strategy issues or unfavorable market conditions.",
                            ),
                            create_stat_card(
                                "Monthly WR",
                                f"{monthly_wr:.2f}%",
                                color="green",
                                tooltip_content="Monthly building success - percentage of months that added to your foundation.",
                                tooltip_detailed="Percentage of months that were profitable. Monthly win rate provides insight into consistency over longer time periods. Higher monthly win rates indicate more predictable income generation and smoother equity curves.",
                            ),
                            create_stat_card(
                                "Weekly WR",
                                f"{weekly_wr:.2f}%",
                                color="gray",
                                tooltip_content="Weekly building success - percentage of weeks that strengthened your structure.",
                                tooltip_detailed="Percentage of weeks that were profitable. Weekly win rate shows shorter-term consistency and can help identify if your strategy works better in certain market conditions or time frames. Useful for weekly review cycles.",
                            ),
                            create_stat_card(
                                "Kelly %",
                                f"{kelly_criterion:.2f}%",
                                color="orange" if kelly_criterion >= 0 else "red",
                                tooltip_content="Optimal foundation size - theoretical best percentage of capital per building project.",
                                tooltip_detailed="Kelly Criterion suggests the optimal position size based on your win rate and average win/loss sizes. Positive values suggest profitable strategies, while negative values indicate unprofitable ones. Most traders use a fraction of Kelly due to its aggressive nature.",
                            ),
                        ],
                        cols=5,
                        spacing="sm",
                    ),
                ],
                gap="xs",
            ),
            # Strategy Breakdown Section
            create_strategy_breakdown(strategy_stats) if strategy_stats else None,
        ],
        gap="lg",
    )


def create_stat_card(
    title, value, subtitle=None, color="gray", tooltip_content=None, tooltip_detailed=None
):
    """Create a statistic card with modern styling and optional tooltip"""
    title_element = dmc.Text(
        title, size="sm", fw=600, ta="center", style={"lineHeight": 1.2, "whiteSpace": "nowrap"}
    )
    if tooltip_content:
        title_element = dmc.Group(
            [
                dmc.Text(
                    title, size="xs", fw=600, ta="center", style={"lineHeight": 1.2, "flex": 1}
                ),
                create_info_tooltip(
                    f"stat-{title.lower().replace(' ', '-').replace('/', '-')}",
                    title,
                    tooltip_content,
                    tooltip_detailed,
                ),
            ],
            gap="2px",
            justify="center",
            align="center",
            wrap="nowrap",
            style={"width": "100%"},
        )

    return dmc.Paper(
        [
            dmc.Stack(
                [
                    title_element,
                    dmc.Text(
                        value, size="xl", fw=700, c=color, ta="center", style={"lineHeight": 1.1}
                    ),
                    (
                        dmc.Text(
                            subtitle, size="xs", c="dimmed", ta="center", style={"lineHeight": 1.2}
                        )
                        if subtitle
                        else None
                    ),
                ],
                gap="xs",
                justify="center",
                align="center",
                style={"height": "100%"},
            )
        ],
        p="sm",
        withBorder=True,
        radius="md",
        style={
            "height": "100px",
            "display": "flex",
            "alignItems": "center",
            "justifyContent": "center",
        },
    )


def create_strategy_breakdown(strategy_stats):
    """Create strategy breakdown section"""
    if not strategy_stats:
        return None

    return dmc.Stack(
        [
            dmc.Text("⚔️ Strategy Breakdown", size="lg", fw=600, c="orange.5", mb="sm"),
            dmc.Paper(
                [
                    dmc.Table(
                        [
                            dmc.TableThead(
                                [
                                    dmc.TableTr(
                                        [
                                            dmc.TableTh(dmc.Text("Strategy", fw=600, size="xs")),
                                            dmc.TableTh(dmc.Text("Trades", fw=600, size="xs")),
                                            dmc.TableTh(dmc.Text("Total P/L", fw=600, size="xs")),
                                            dmc.TableTh(dmc.Text("Win Rate", fw=600, size="xs")),
                                            dmc.TableTh(dmc.Text("Avg Win", fw=600, size="xs")),
                                            dmc.TableTh(dmc.Text("Avg Loss", fw=600, size="xs")),
                                            dmc.TableTh(
                                                dmc.Group(
                                                    [
                                                        dmc.Text(
                                                            "Profit Factor",
                                                            fw=600,
                                                            size="xs",
                                                            style={"flex": 1},
                                                        ),
                                                        create_info_tooltip(
                                                            "profit-factor",
                                                            "Profit Factor",
                                                            "Construction efficiency ratio - total building value divided by total rebuilding costs.",
                                                            "Profit Factor divides total winnings by total losses. Values above 1.0 mean profits exceed losses, while below 1.0 indicates net losses. A profit factor of 2.0 means you made $2 in profits for every $1 lost. This metric helps evaluate strategy profitability independent of win rate.",
                                                        ),
                                                    ],
                                                    gap="2px",
                                                    align="center",
                                                    wrap="nowrap",
                                                    style={"width": "100%"},
                                                )
                                            ),
                                        ]
                                    )
                                ]
                            ),
                            dmc.TableTbody(
                                [
                                    dmc.TableTr(
                                        [
                                            dmc.TableTd(strategy, style={"fontWeight": 500}),
                                            dmc.TableTd(f"{stats['trade_count']}"),
                                            dmc.TableTd(
                                                f"${stats['total_pl']:,.0f}",
                                                c="green" if stats["total_pl"] > 0 else "red",
                                                fw=500,
                                            ),
                                            dmc.TableTd(f"{stats['win_rate']:.1%}"),
                                            dmc.TableTd(f"${stats['avg_win']:,.0f}"),
                                            dmc.TableTd(f"${stats['avg_loss']:,.0f}"),
                                            dmc.TableTd(f"{stats['profit_factor']:.2f}"),
                                        ]
                                    )
                                    for strategy, stats in strategy_stats.items()
                                ]
                            ),
                        ],
                        striped=True,
                        highlightOnHover=True,
                        withTableBorder=True,
                    )
                ],
                p="md",
                withBorder=True,
                radius="md",
            ),
        ],
        gap="xs",
    )
