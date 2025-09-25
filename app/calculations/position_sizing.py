"""Domain calculations for the position sizing tab."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Dict, Iterable, List, Mapping, MutableMapping, Optional, Sequence, Tuple

from collections import defaultdict

from app.utils.kelly import calculate_kelly_metrics


Number = float


def _trade_identifier(trade: Any) -> Any:
    if isinstance(trade, dict):
        return trade.get("trade_id") or trade.get("id") or id(trade)
    for attr in ("trade_id", "id"):
        value = getattr(trade, attr, None)
        if value is not None:
            return value
    return id(trade)


def _as_date(value: Any) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, datetime):
        return value.date()
    try:
        return datetime.fromisoformat(str(value)).date()
    except (TypeError, ValueError):
        return None


def extract_strategy_name(trade: Any) -> str:
    if isinstance(trade, dict):
        name = trade.get("strategy")
    else:
        name = getattr(trade, "strategy", None)
    return name or "Uncategorized"


def get_net_liq_from_daily_log(daily_log_data, date_str: str):
    if not daily_log_data:
        return None

    entries = daily_log_data
    if isinstance(daily_log_data, dict):
        entries = daily_log_data.get("entries", [])

    for entry in entries:
        if entry.get("date") == date_str:
            return entry.get("net_liq")

    return None


def calculate_running_net_liq(trades, starting_capital: float, daily_log_data=None):
    sorted_trades = sorted(
        trades,
        key=lambda t: (
            getattr(t, "date_opened", None) or getattr(t, "date", None) or datetime.min.date(),
            getattr(t, "time_opened", None) or getattr(t, "time", None) or datetime.min.time(),
        ),
    )

    net_liq_timeline = {}
    cumulative_pnl = 0.0
    closed_trades = []

    for trade in sorted_trades:
        trade_id = _trade_identifier(trade)
        trade_open = getattr(trade, "date_opened", None)
        if trade_open is None and isinstance(trade, dict):
            trade_open = trade.get("date_opened")

        if not trade_open:
            net_liq_timeline[trade_id] = starting_capital
            continue

        date_str = trade_open.isoformat() if hasattr(trade_open, "isoformat") else str(trade_open)

        net_liq_from_log = (
            get_net_liq_from_daily_log(daily_log_data, date_str) if daily_log_data else None
        )

        if net_liq_from_log is not None:
            net_liq_timeline[trade_id] = net_liq_from_log
            continue

        for closed_trade in sorted_trades:
            closed_date = getattr(closed_trade, "date_closed", None)
            if closed_date is None and isinstance(closed_trade, dict):
                closed_date = closed_trade.get("date_closed")

            if closed_date and closed_date < trade_open and closed_trade not in closed_trades:
                trade_pnl = getattr(closed_trade, "pl", None)
                if trade_pnl is None and isinstance(closed_trade, dict):
                    trade_pnl = closed_trade.get("pl") or closed_trade.get("pnl")
                if trade_pnl is not None:
                    cumulative_pnl += float(trade_pnl)
                closed_trades.append(closed_trade)

        net_liq_timeline[trade_id] = starting_capital + cumulative_pnl

    return net_liq_timeline


def calculate_margin_pct(
    trade, starting_capital: float, margin_mode: str = "fixed", net_liq_timeline=None
) -> float:
    margin_req = (
        trade.get("margin_req", 0) if isinstance(trade, dict) else getattr(trade, "margin_req", 0)
    )

    if margin_mode == "compounding" and net_liq_timeline:
        trade_id = _trade_identifier(trade)
        denominator = net_liq_timeline.get(trade_id, starting_capital)
    else:
        denominator = starting_capital

    if not denominator:
        return 0.0
    try:
        return (float(margin_req) / denominator) * 100
    except (TypeError, ValueError):
        return 0.0


def build_strategy_settings(
    trades: Iterable[Any],
    strategy_kelly_values: Optional[Iterable[Any]],
    strategy_kelly_ids: Optional[Iterable[Any]],
    global_kelly_pct: float,
) -> Dict[str, Dict[str, float]]:
    strategies_settings: Dict[str, Dict[str, float]] = {}

    if strategy_kelly_values and strategy_kelly_ids:
        for value, comp_id in zip(strategy_kelly_values, strategy_kelly_ids):
            strategy_name = None
            if isinstance(comp_id, dict):
                strategy_name = comp_id.get("strategy")
            if not strategy_name:
                continue

            kelly_pct = global_kelly_pct
            if value not in (None, ""):
                try:
                    kelly_pct = float(value)
                except (TypeError, ValueError):
                    kelly_pct = global_kelly_pct

            strategies_settings[strategy_name] = {"kelly_pct": max(0.0, kelly_pct)}

    for trade in trades:
        strategy_name = extract_strategy_name(trade)
        strategies_settings.setdefault(strategy_name, {"kelly_pct": global_kelly_pct})

    return strategies_settings


@dataclass
class MarginTimeline:
    dates: List[str]
    portfolio_pct: List[float]
    strategy_pct: Dict[str, List[float]]
    net_liq: Dict[str, float]
    mode: str


@dataclass
class StrategyAnalysis:
    name: str
    trade_count: int
    kelly_pct: float
    input_pct: float
    applied_pct: float
    win_rate: float
    payoff_ratio: float
    avg_win: float
    avg_loss: float
    max_margin_pct: float
    has_data: bool
    allocation_pct: float
    allocation_dollars: float


@dataclass
class PortfolioAllocationSummary:
    weighted_applied_pct: float
    applied_capital: float


@dataclass
class PositionSizingCalculations:
    strategies_settings: Dict[str, Dict[str, float]]
    strategy_names: List[str]
    strategy_trade_map: Dict[str, List[Any]]
    portfolio_metrics: Any
    strategy_analysis: List[StrategyAnalysis]
    margin_timeline: MarginTimeline
    summary: PortfolioAllocationSummary


def collect_strategy_trades(trades: Sequence[Any]) -> Tuple[Dict[str, List[Any]], Dict[str, int]]:
    strategy_trade_map: Dict[str, List[Any]] = defaultdict(list)
    trade_counts: Dict[str, int] = defaultdict(int)

    for trade in trades:
        strategy_name = extract_strategy_name(trade)
        strategy_trade_map[strategy_name].append(trade)
        trade_counts[strategy_name] += 1

    return strategy_trade_map, trade_counts


def build_margin_timeline(
    trades: Sequence[Any],
    strategy_names: Sequence[str],
    starting_capital: float,
    margin_mode: str,
    daily_log_data=None,
) -> Tuple[MarginTimeline, Dict[str, Dict[str, float]]]:
    margin_totals: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))

    from datetime import timedelta

    for trade in trades:
        margin_req = getattr(trade, "margin_req", None)
        if margin_req is None and isinstance(trade, dict):
            margin_req = trade.get("margin_req")
        if margin_req in (None, 0):
            continue
        try:
            margin_value = float(margin_req)
        except (TypeError, ValueError):
            continue

        date_opened = getattr(trade, "date_opened", None)
        if date_opened is None and isinstance(trade, dict):
            date_opened = trade.get("date_opened")
        date_closed = getattr(trade, "date_closed", None)
        if date_closed is None and isinstance(trade, dict):
            date_closed = trade.get("date_closed")

        if not date_opened:
            continue

        start_date = _as_date(date_opened)
        end_date = _as_date(date_closed) or start_date

        if start_date is None:
            continue
        if end_date < start_date:
            end_date = start_date

        strategy_name = extract_strategy_name(trade)

        current_date = start_date
        while current_date <= end_date:
            date_key = current_date.isoformat()
            margin_totals[date_key][strategy_name] += margin_value
            margin_totals[date_key]["__total__"] += margin_value
            current_date += timedelta(days=1)

    sorted_dates = sorted(margin_totals.keys())
    portfolio_margin_pct: List[float] = []
    strategy_margin_pct_series: Dict[str, List[float]] = {name: [] for name in strategy_names}

    date_to_net_liq: Dict[str, float] = {}
    if margin_mode == "compounding":
        date_to_net_liq = _build_date_to_net_liq(
            trades,
            sorted_dates,
            starting_capital,
            daily_log_data,
        )

    for date_key in sorted_dates:
        total_margin = margin_totals[date_key].get("__total__", 0.0)
        if margin_mode == "compounding":
            denominator = date_to_net_liq.get(date_key, starting_capital)
        else:
            denominator = starting_capital

        denominator = denominator or starting_capital
        portfolio_margin_pct.append((total_margin / denominator) * 100 if denominator > 0 else 0.0)

        for name in strategy_names:
            strategy_margin = margin_totals[date_key].get(name, 0.0)
            strategy_margin_pct_series[name].append(
                (strategy_margin / denominator) * 100 if denominator > 0 else 0.0
            )

    return (
        MarginTimeline(
            dates=sorted_dates,
            portfolio_pct=portfolio_margin_pct,
            strategy_pct=strategy_margin_pct_series,
            net_liq=date_to_net_liq,
            mode=margin_mode,
        ),
        margin_totals,
    )


def _build_date_to_net_liq(
    trades,
    date_keys,
    starting_capital: float,
    daily_log_data=None,
):
    date_to_net_liq = {}
    if not date_keys:
        return date_to_net_liq

    cumulative_pnl = 0.0
    closed_trades_seen = set()

    for date_key in date_keys:
        current_date = _as_date(date_key)
        if current_date is None:
            try:
                current_date = datetime.fromisoformat(str(date_key)).date()
            except (TypeError, ValueError):
                continue

        for trade in trades:
            trade_key = _trade_identifier(trade)
            if trade_key in closed_trades_seen:
                continue

            date_closed = getattr(trade, "date_closed", None)
            if date_closed is None and isinstance(trade, dict):
                date_closed = trade.get("date_closed")
            close_date = _as_date(date_closed)
            if close_date is None or close_date > current_date:
                continue

            trade_pnl = getattr(trade, "pl", None)
            if trade_pnl is None and isinstance(trade, dict):
                trade_pnl = trade.get("pl") or trade.get("pnl")

            if trade_pnl is not None:
                try:
                    cumulative_pnl += float(trade_pnl)
                except (TypeError, ValueError):
                    pass

            closed_trades_seen.add(trade_key)

        net_liq_from_log = (
            get_net_liq_from_daily_log(daily_log_data, current_date.isoformat())
            if daily_log_data
            else None
        )

        if net_liq_from_log is not None:
            date_to_net_liq[current_date.isoformat()] = net_liq_from_log
        else:
            date_to_net_liq[current_date.isoformat()] = starting_capital + cumulative_pnl

    return date_to_net_liq


def build_strategy_analysis(
    strategy_names: Sequence[str],
    strategy_trade_map: Mapping[str, Sequence[Any]],
    strategies_settings: Mapping[str, Mapping[str, Number]],
    strategy_margin_pct_series: Mapping[str, Sequence[Number]],
    starting_capital: float,
) -> Tuple[List[StrategyAnalysis], PortfolioAllocationSummary]:
    strategy_analysis: List[StrategyAnalysis] = []
    total_applied_weight = 0.0
    total_trades = sum(len(strategy_trade_map.get(name, [])) for name in strategy_names)

    for name in strategy_names:
        strat_trades = list(strategy_trade_map.get(name, []))
        trade_count = len(strat_trades)
        metrics = calculate_kelly_metrics(strat_trades)
        raw_input_pct = strategies_settings.get(name, {}).get("kelly_pct", 0.0)
        try:
            input_pct = max(0.0, float(raw_input_pct))
        except (TypeError, ValueError):
            input_pct = 0.0

        applied_pct = metrics.percent * (input_pct / 100.0)
        margin_series = list(strategy_margin_pct_series.get(name, []))
        max_margin_pct = max(margin_series) if margin_series else 0.0

        allocation_pct = max_margin_pct * (input_pct / 100.0)
        allocation_dollars = starting_capital * allocation_pct / 100.0

        strategy_analysis.append(
            StrategyAnalysis(
                name=name,
                trade_count=trade_count,
                kelly_pct=metrics.percent,
                input_pct=input_pct,
                applied_pct=applied_pct,
                win_rate=metrics.win_rate,
                payoff_ratio=metrics.payoff_ratio,
                avg_win=metrics.avg_win,
                avg_loss=metrics.avg_loss,
                max_margin_pct=max_margin_pct,
                has_data=metrics.avg_win > 0 and metrics.avg_loss > 0,
                allocation_pct=allocation_pct,
                allocation_dollars=allocation_dollars,
            )
        )

        if trade_count > 0:
            total_applied_weight += applied_pct * trade_count

    weighted_applied_pct = total_applied_weight / total_trades if total_trades else 0.0
    applied_capital = starting_capital * weighted_applied_pct / 100.0

    summary = PortfolioAllocationSummary(
        weighted_applied_pct=weighted_applied_pct,
        applied_capital=applied_capital,
    )

    return strategy_analysis, summary


def build_margin_statistics(
    margin_timeline: MarginTimeline,
    strategy_analysis: Sequence[StrategyAnalysis],
    weighted_applied_pct: float,
    portfolio_kelly_pct: float,
) -> List[Dict[str, float | str | bool]]:
    stats: List[Dict[str, float | str | bool]] = []

    portfolio_max_margin_pct = (
        max(margin_timeline.portfolio_pct) if margin_timeline.portfolio_pct else 0.0
    )
    if portfolio_max_margin_pct and portfolio_kelly_pct:
        stats.append(
            {
                "name": "Portfolio",
                "historical_max": portfolio_max_margin_pct,
                "expected": portfolio_max_margin_pct * (portfolio_kelly_pct / 100.0),
                "allocated": weighted_applied_pct,
                "is_portfolio": True,
            }
        )

    for analysis in strategy_analysis:
        if analysis.max_margin_pct and analysis.input_pct:
            expected = analysis.max_margin_pct * (analysis.input_pct / 100.0)
            stats.append(
                {
                    "name": analysis.name,
                    "historical_max": analysis.max_margin_pct,
                    "expected": expected,
                    "allocated": analysis.applied_pct,
                    "is_portfolio": False,
                }
            )

    return stats


def calculate_position_sizing(
    trades: Sequence[Any],
    starting_capital: float,
    global_kelly_pct: float,
    strategy_kelly_values: Optional[Iterable[Any]],
    strategy_kelly_ids: Optional[Iterable[Any]],
    margin_mode: str,
    daily_log_data=None,
) -> PositionSizingCalculations:
    portfolio_metrics = calculate_kelly_metrics(trades)

    strategies_settings = build_strategy_settings(
        trades,
        strategy_kelly_values,
        strategy_kelly_ids,
        global_kelly_pct,
    )

    strategy_trade_map, trade_counts = collect_strategy_trades(trades)

    strategy_names = sorted(
        strategies_settings.keys(),
        key=lambda name: (-trade_counts.get(name, 0), name.lower()),
    )

    margin_timeline, _ = build_margin_timeline(
        trades,
        strategy_names,
        starting_capital,
        margin_mode,
        daily_log_data,
    )

    strategy_analysis, summary = build_strategy_analysis(
        strategy_names,
        strategy_trade_map,
        strategies_settings,
        margin_timeline.strategy_pct,
        starting_capital,
    )

    return PositionSizingCalculations(
        strategies_settings=strategies_settings,
        strategy_names=strategy_names,
        strategy_trade_map=strategy_trade_map,
        portfolio_metrics=portfolio_metrics,
        strategy_analysis=strategy_analysis,
        margin_timeline=margin_timeline,
        summary=summary,
    )
