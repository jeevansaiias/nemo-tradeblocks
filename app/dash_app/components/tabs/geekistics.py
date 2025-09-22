import dash_mantine_components as dmc
from dash import html, dcc
from dash_iconify import DashIconify
import plotly.graph_objects as go
import plotly.express as px


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
                            create_stat_card("Number of Trades", f"{total_trades:,}", color="gray"),
                            create_stat_card(
                                "Starting Capital", f"${initial_capital:,.0f}", color="gray"
                            ),
                            create_stat_card(
                                "Avg Return on Margin",
                                f"↗ {avg_return_on_margin:.2f}%",
                                color="green",
                            ),
                            create_stat_card(
                                "Std Dev of RoM", f"{std_dev_rom:.2f}%", color="orange"
                            ),
                            create_stat_card(
                                "Best Trade", f"↗ {best_trade_pct:.2f}%", color="green"
                            ),
                            create_stat_card(
                                "Worst Trade", f"↘ {worst_trade_pct:.2f}%", color="red"
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
                            ),
                            create_stat_card(
                                "CAGR", f"{cagr:.2f}%", color="green" if cagr > 0 else "red"
                            ),
                            create_stat_card(
                                "Avg RoM", f"{avg_return_on_margin:.2f}%", color="gray"
                            ),
                            create_stat_card(
                                "Win Rate",
                                f"{portfolio_stats.get('win_rate', 0)*100:.2f}%",
                                color="green",
                            ),
                            create_stat_card(
                                "Loss Rate",
                                f"{(1-portfolio_stats.get('win_rate', 0))*100:.2f}%",
                                color="red",
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
                            ),
                            create_stat_card("Time in DD", f"{time_in_dd:.2f}%", color="orange"),
                            create_stat_card("Sharpe Ratio", f"{sharpe_ratio:.2f}", color="gray"),
                            create_stat_card("Sortino Ratio", f"{sortino_ratio:.2f}", color="gray"),
                            create_stat_card("Calmar Ratio", f"{calmar_ratio:.2f}", color="green"),
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
                            create_stat_card("Win Streak", f"{max_win_streak}", color="green"),
                            create_stat_card("Loss Streak", f"{max_loss_streak}", color="red"),
                            create_stat_card("Monthly WR", f"{monthly_wr:.2f}%", color="green"),
                            create_stat_card("Weekly WR", f"{weekly_wr:.2f}%", color="gray"),
                            create_stat_card(
                                "Kelly %",
                                f"{kelly_criterion:.2f}%",
                                color="orange" if kelly_criterion >= 0 else "red",
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


def create_stat_card(title, value, subtitle=None, color="gray"):
    """Create a statistic card with modern styling"""
    return dmc.Paper(
        [
            dmc.Stack(
                [
                    dmc.Text(title, size="sm", fw=600, ta="center", style={"lineHeight": 1.2}),
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
        p="md",
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
                                            dmc.TableTh(dmc.Text("Strategy", fw=600)),
                                            dmc.TableTh(dmc.Text("Trades", fw=600)),
                                            dmc.TableTh(dmc.Text("Total P/L", fw=600)),
                                            dmc.TableTh(dmc.Text("Win Rate", fw=600)),
                                            dmc.TableTh(dmc.Text("Avg Win", fw=600)),
                                            dmc.TableTh(dmc.Text("Avg Loss", fw=600)),
                                            dmc.TableTh(dmc.Text("Profit Factor", fw=600)),
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
