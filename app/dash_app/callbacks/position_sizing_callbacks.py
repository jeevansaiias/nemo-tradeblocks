"""
Position Sizing Callbacks - Kelly Criterion and Risk Management

Handles callbacks for position sizing analysis including Kelly Criterion,
Risk of Ruin, and other position sizing methodologies.
"""

import logging
import numpy as np
import dash_mantine_components as dmc
from dash import callback, Input, Output
from dash.exceptions import PreventUpdate

from app.data.models import Portfolio

logger = logging.getLogger(__name__)


def register_position_sizing_callbacks(app):
    """Register all position sizing related callbacks"""

    @app.callback(
        Output("position-sizing-kelly-analysis", "children"),
        [Input("current-portfolio-data", "data")],
    )
    def update_kelly_analysis(portfolio_data):
        """Update Kelly Criterion based on historical portfolio performance"""
        if not portfolio_data:
            return dmc.Text(
                "Load portfolio data to see position sizing recommendations", c="dimmed"
            )

        try:
            portfolio = Portfolio(**portfolio_data)
            trades = portfolio.trades

            # Calculate Kelly Criterion from historical trades
            wins = [trade.pl for trade in trades if trade.pl > 0]
            losses = [abs(trade.pl) for trade in trades if trade.pl < 0]

            kelly_content = []

            if wins and losses:
                win_rate = len(wins) / len(trades)
                avg_win = np.mean(wins)
                avg_loss = np.mean(losses)

                # Kelly formula: f = (bp - q) / b
                # where b = avg_win/avg_loss, p = win_probability, q = 1-p
                b = avg_win / avg_loss
                p = win_rate
                q = 1 - p

                kelly_fraction = (b * p - q) / b
                kelly_pct = kelly_fraction * 100

                kelly_content = [
                    dmc.Grid(
                        [
                            dmc.GridCol(
                                [
                                    dmc.Paper(
                                        [
                                            dmc.Stack(
                                                [
                                                    dmc.Text(
                                                        "🧱 Kelly Criterion", fw=600, size="lg"
                                                    ),
                                                    dmc.Text(
                                                        f"{kelly_pct:.1f}%",
                                                        size="xl",
                                                        fw=700,
                                                        c="blue",
                                                    ),
                                                    dmc.Text(
                                                        "Optimal position size based on your win rate and payoff ratio",
                                                        size="sm",
                                                        c="dimmed",
                                                    ),
                                                    dmc.Divider(),
                                                    dmc.SimpleGrid(
                                                        cols=2,
                                                        children=[
                                                            dmc.Stack(
                                                                [
                                                                    dmc.Text(
                                                                        "Win Rate",
                                                                        size="xs",
                                                                        c="dimmed",
                                                                    ),
                                                                    dmc.Text(
                                                                        f"{win_rate:.1%}", fw=600
                                                                    ),
                                                                ],
                                                                gap="xs",
                                                            ),
                                                            dmc.Stack(
                                                                [
                                                                    dmc.Text(
                                                                        "Avg Win/Loss Ratio",
                                                                        size="xs",
                                                                        c="dimmed",
                                                                    ),
                                                                    dmc.Text(f"{b:.2f}x", fw=600),
                                                                ],
                                                                gap="xs",
                                                            ),
                                                            dmc.Stack(
                                                                [
                                                                    dmc.Text(
                                                                        "Average Win",
                                                                        size="xs",
                                                                        c="dimmed",
                                                                    ),
                                                                    dmc.Text(
                                                                        f"${avg_win:,.0f}",
                                                                        fw=600,
                                                                        c="green",
                                                                    ),
                                                                ],
                                                                gap="xs",
                                                            ),
                                                            dmc.Stack(
                                                                [
                                                                    dmc.Text(
                                                                        "Average Loss",
                                                                        size="xs",
                                                                        c="dimmed",
                                                                    ),
                                                                    dmc.Text(
                                                                        f"${avg_loss:,.0f}",
                                                                        fw=600,
                                                                        c="red",
                                                                    ),
                                                                ],
                                                                gap="xs",
                                                            ),
                                                        ],
                                                    ),
                                                    dmc.Alert(
                                                        children=[
                                                            dmc.Text(
                                                                "🎯 Recommendation",
                                                                fw=600,
                                                                size="sm",
                                                            ),
                                                            dmc.Text(
                                                                f"Based on your historical performance, the Kelly Criterion suggests risking {kelly_pct:.1f}% of your capital per trade. "
                                                                f"Many traders use 'Half Kelly' ({kelly_pct/2:.1f}%) or 'Quarter Kelly' ({kelly_pct/4:.1f}%) for more conservative sizing.",
                                                                size="sm",
                                                            ),
                                                        ],
                                                        color="blue" if kelly_pct > 0 else "red",
                                                        variant="light",
                                                    ),
                                                ],
                                                gap="md",
                                            ),
                                        ],
                                        p="lg",
                                        withBorder=True,
                                    )
                                ],
                                span=12,
                            )
                        ]
                    )
                ]
            else:
                kelly_content = [
                    dmc.Alert(
                        children="Insufficient trade data for Kelly Criterion calculation. Need both winning and losing trades.",
                        color="orange",
                        variant="light",
                    )
                ]

            return kelly_content

        except Exception as e:
            logger.error(f"Error calculating Kelly Criterion: {str(e)}")
            return dmc.Alert(
                children=f"Error calculating Kelly Criterion: {str(e)}",
                color="red",
                variant="light",
            )
