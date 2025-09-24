"""Shared utilities for Kelly Criterion calculations."""

from dataclasses import dataclass
from typing import Iterable, Any

import numpy as np


@dataclass(frozen=True)
class KellyMetrics:
    """Container for Kelly Criterion related outputs."""

    fraction: float
    percent: float
    win_rate: float
    payoff_ratio: float
    avg_win: float
    avg_loss: float


_ZERO_METRICS = KellyMetrics(
    fraction=0.0,
    percent=0.0,
    win_rate=0.0,
    payoff_ratio=0.0,
    avg_win=0.0,
    avg_loss=0.0,
)


def _extract_pl(trade: Any, pl_key: str) -> float:
    """Best-effort extraction of profit/loss from trade-like objects."""
    if isinstance(trade, dict):
        value = trade.get(pl_key, 0)  # type: ignore[index]
    else:
        value = getattr(trade, pl_key, 0)

    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def calculate_kelly_metrics(trades: Iterable[Any], pl_key: str = "pl") -> KellyMetrics:
    """Return Kelly Criterion metrics for an iterable of trades.

    Trades may be dictionaries or objects with a `pl` attribute. When insufficient
    information is available (no wins, no losses, or zero denominator), the
    function returns zeroed metrics.
    """
    trades_list = list(trades)

    if not trades_list:
        return _ZERO_METRICS

    wins = []
    losses = []

    for trade in trades_list:
        pl = _extract_pl(trade, pl_key)
        if pl > 0:
            wins.append(pl)
        elif pl < 0:
            losses.append(abs(pl))

    if not wins or not losses:
        return _ZERO_METRICS

    total_trades = len(trades_list)
    win_rate = len(wins) / total_trades
    avg_win = float(np.mean(wins))
    avg_loss = float(np.mean(losses))

    if avg_loss == 0:
        return _ZERO_METRICS

    payoff_ratio = avg_win / avg_loss
    loss_rate = 1 - win_rate
    kelly_fraction = (payoff_ratio * win_rate - loss_rate) / payoff_ratio
    kelly_percent = kelly_fraction * 100

    return KellyMetrics(
        fraction=kelly_fraction,
        percent=kelly_percent,
        win_rate=win_rate,
        payoff_ratio=payoff_ratio,
        avg_win=avg_win,
        avg_loss=avg_loss,
    )
