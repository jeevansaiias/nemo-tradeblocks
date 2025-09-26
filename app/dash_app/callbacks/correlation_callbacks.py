"""
🔗 Correlation Matrix Callbacks

Handles all interactive functionality for the correlation matrix tab including:
- Dynamic correlation calculation and visualization
- Interactive heatmap updates
- Network graph generation
- Strategy pair analysis
- Export functionality
"""

from dash import callback, Input, Output, State, no_update, ctx
import dash_mantine_components as dmc
import plotly.graph_objects as go
import plotly.express as px
import pandas as pd
import numpy as np
import json
import logging
import re
from datetime import datetime, timedelta
from typing import Dict, List, Any

from app.calculations.correlation import CorrelationCalculator
from app.data.processor import PortfolioProcessor
from app.services.portfolio_service import resolve_portfolio_payload

logger = logging.getLogger(__name__)

# Removed standalone callback - now handled in register_correlation_callbacks function


def filter_trades_by_criteria(trades, time_period, min_trades):
    """Filter trades based on time period and minimum trade criteria"""
    filtered_trades = list(trades)

    # Apply time period filter
    if time_period != "all":
        cutoff_date = get_cutoff_date(time_period)
        filtered_trades = [trade for trade in filtered_trades if trade.date_opened >= cutoff_date]

    # Group by strategy and filter by minimum trades
    strategy_counts = {}
    for trade in filtered_trades:
        strategy_counts[trade.strategy] = strategy_counts.get(trade.strategy, 0) + 1

    valid_strategies = {
        strategy for strategy, count in strategy_counts.items() if count >= min_trades
    }

    filtered_trades = [trade for trade in filtered_trades if trade.strategy in valid_strategies]

    return filtered_trades


def get_cutoff_date(time_period):
    """Get cutoff date based on time period string"""
    now = datetime.now()

    if time_period == "90d":
        return now - timedelta(days=90)
    elif time_period == "180d":
        return now - timedelta(days=180)
    elif time_period == "365d":
        return now - timedelta(days=365)
    else:
        return datetime.min  # Return all time for unknown periods


def calculate_portfolio_correlations(trades, method="pearson"):
    """Calculate correlation matrix for portfolio strategies"""
    # Group trades by strategy and date
    strategy_daily_returns = {}

    for trade in trades:
        strategy = trade.strategy
        date_key = trade.date_opened.strftime("%Y-%m-%d")

        if strategy not in strategy_daily_returns:
            strategy_daily_returns[strategy] = {}

        if date_key not in strategy_daily_returns[strategy]:
            strategy_daily_returns[strategy][date_key] = 0

        strategy_daily_returns[strategy][date_key] += trade.pl

    # Convert to DataFrame
    strategies = list(strategy_daily_returns.keys())

    if len(strategies) < 2:
        return {"strategies": [], "matrix": [], "returns_data": {}}

    # Get all unique dates
    all_dates = set()
    for strategy_returns in strategy_daily_returns.values():
        all_dates.update(strategy_returns.keys())

    all_dates = sorted(list(all_dates))

    # Create returns matrix
    returns_matrix = []
    for strategy in strategies:
        strategy_returns = []
        for date in all_dates:
            returns = strategy_daily_returns[strategy].get(date, 0)
            strategy_returns.append(returns)
        returns_matrix.append(strategy_returns)

    # Calculate correlation matrix
    df = pd.DataFrame(returns_matrix, index=strategies, columns=all_dates).T
    correlation_matrix = df.corr(method=method)

    return {
        "strategies": strategies,
        "matrix": correlation_matrix.values.tolist(),
        "returns_data": strategy_daily_returns,
        "dates": all_dates,
    }


def create_correlation_heatmap(correlation_data, color_scheme, show_values):
    """Create correlation heatmap visualization"""
    strategies = correlation_data["strategies"]
    matrix = np.array(correlation_data["matrix"])

    # Create text annotations if requested
    text = np.round(matrix, 3) if show_values else None
    texttemplate = "%{text}" if show_values else None

    fig = go.Figure(
        data=go.Heatmap(
            z=matrix,
            x=strategies,
            y=strategies,
            colorscale=color_scheme,
            zmid=0,
            zmin=-1,
            zmax=1,
            text=text,
            texttemplate=texttemplate,
            textfont={"size": 10, "color": "white"},
            hoverongaps=False,
            colorbar=dict(
                title="Correlation Coefficient",
                titleside="right",
                tickvals=[-1, -0.5, 0, 0.5, 1],
                ticktext=["-1", "-0.5", "0", "0.5", "1"],
            ),
        )
    )

    # Update layout
    fig.update_layout(
        title=dict(text="Strategy Correlation Matrix", x=0.5, font=dict(size=16)),
        xaxis=dict(title="Strategies", tickangle=45, side="bottom"),
        yaxis=dict(
            title="Strategies", autorange="reversed"  # To match typical correlation matrix display
        ),
        font=dict(size=11),
        height=500,
        margin=dict(l=100, r=100, t=60, b=120),
        plot_bgcolor="white",
    )

    return fig


def create_correlation_network(correlation_data, threshold):
    """Create network graph showing strategy relationships"""
    strategies = correlation_data["strategies"]
    matrix = np.array(correlation_data["matrix"])

    if len(strategies) < 2:
        return create_empty_network()

    # Network graph functionality disabled for lighter deployment
    # TODO: Re-implement network graph with lightweight alternative
    return create_empty_network_with_threshold(threshold)


def calculate_correlation_analytics(correlation_data):
    """Calculate analytics and insights from correlation data"""
    strategies = correlation_data["strategies"]
    matrix = np.array(correlation_data["matrix"])

    if len(strategies) < 2:
        return {
            "strongest_correlation": {"value": 0, "pair": ["N/A", "N/A"]},
            "weakest_correlation": {"value": 0, "pair": ["N/A", "N/A"]},
            "most_diversified": {"strategy": "N/A", "avg_correlation": 0},
            "clusters": {"count": 0, "groups": []},
        }

    # Find strongest and weakest correlations (excluding diagonal)
    correlations = []
    for i in range(len(strategies)):
        for j in range(i + 1, len(strategies)):
            correlations.append(
                {"value": matrix[i][j], "pair": [strategies[i], strategies[j]], "indices": (i, j)}
            )

    correlations.sort(key=lambda x: abs(x["value"]), reverse=True)

    strongest = correlations[0] if correlations else {"value": 0, "pair": ["N/A", "N/A"]}
    weakest = correlations[-1] if correlations else {"value": 0, "pair": ["N/A", "N/A"]}

    # Find most diversified strategy (lowest average correlation)
    avg_correlations = []
    for i, strategy in enumerate(strategies):
        correlations_for_strategy = []
        for j in range(len(strategies)):
            if i != j:
                correlations_for_strategy.append(abs(matrix[i][j]))

        avg_corr = np.mean(correlations_for_strategy) if correlations_for_strategy else 0
        avg_correlations.append({"strategy": strategy, "avg_correlation": avg_corr})

    most_diversified = (
        min(avg_correlations, key=lambda x: x["avg_correlation"])
        if avg_correlations
        else {"strategy": "N/A", "avg_correlation": 0}
    )

    # Simple clustering based on correlation threshold
    clusters = identify_correlation_clusters(matrix, strategies, threshold=0.7)

    return {
        "strongest_correlation": strongest,
        "weakest_correlation": weakest,
        "most_diversified": most_diversified,
        "clusters": clusters,
        "all_correlations": correlations,
    }


def identify_correlation_clusters(matrix, strategies, threshold=0.7):
    """Identify clusters of highly correlated strategies (simplified without networkx)"""
    # Simplified clustering without networkx - just find highly correlated pairs
    cluster_groups = []
    clustered_strategies = set()

    for i in range(len(strategies)):
        if strategies[i] in clustered_strategies:
            continue

        cluster = [strategies[i]]
        clustered_strategies.add(strategies[i])

        # Find strategies highly correlated with this one
        for j in range(i + 1, len(strategies)):
            if abs(matrix[i][j]) >= threshold and strategies[j] not in clustered_strategies:
                cluster.append(strategies[j])
                clustered_strategies.add(strategies[j])

        if len(cluster) > 1:  # Only include clusters with multiple strategies
            cluster_groups.append(
                {"id": len(cluster_groups), "strategies": cluster, "size": len(cluster)}
            )

    return {"count": len(cluster_groups), "groups": cluster_groups}


def create_analytics_content(analytics):
    """Create analytics content for the analytics panel"""
    correlations = analytics.get("all_correlations", [])

    if not correlations:
        return dmc.Text("No correlation data available", size="sm", c="dimmed")

    # Create top/bottom correlations lists
    top_correlations = sorted(correlations, key=lambda x: x["value"], reverse=True)[:3]
    bottom_correlations = sorted(correlations, key=lambda x: x["value"])[:3]

    return dmc.Stack(
        [
            # Top Correlations
            dmc.Stack(
                [
                    dmc.Text("Strongest Positive Correlations", size="sm", fw=600, c="green"),
                    *[
                        dmc.Group(
                            [
                                dmc.Text(f"{corr['pair'][0]} ↔ {corr['pair'][1]}", size="sm"),
                                dmc.Badge(f"{corr['value']:.3f}", color="green", variant="light"),
                            ],
                            justify="space-between",
                        )
                        for corr in top_correlations
                        if corr["value"] > 0
                    ],
                ],
                gap="xs",
            ),
            # Bottom Correlations
            dmc.Stack(
                [
                    dmc.Text("Strongest Negative Correlations", size="sm", fw=600, c="red"),
                    *(
                        [
                            dmc.Group(
                                [
                                    dmc.Text(f"{corr['pair'][0]} ↔ {corr['pair'][1]}", size="sm"),
                                    dmc.Badge(f"{corr['value']:.3f}", color="red", variant="light"),
                                ],
                                justify="space-between",
                            )
                            for corr in bottom_correlations
                            if corr["value"] < 0
                        ]
                        if any(corr["value"] < 0 for corr in bottom_correlations)
                        else [dmc.Text("No negative correlations found", size="sm", c="dimmed")]
                    ),
                ],
                gap="xs",
            ),
            # Summary stats
            dmc.Divider(),
            dmc.Group(
                [
                    dmc.Text(f"Total pairs analyzed: {len(correlations)}", size="sm"),
                    dmc.Text(
                        f"Avg correlation: {np.mean([c['value'] for c in correlations]):.3f}",
                        size="sm",
                    ),
                ],
                justify="space-between",
            ),
        ],
        gap="md",
    )


# Empty/Error state functions
def create_empty_heatmap(is_dark_mode=False):
    """Create empty heatmap placeholder"""
    bg_color = "#1a1a1a" if is_dark_mode else "white"
    text_color = "#e0e0e0" if is_dark_mode else "gray"

    fig = go.Figure()
    fig.add_annotation(
        text="Upload portfolio data to see correlation matrix",
        xref="paper",
        yref="paper",
        x=0.5,
        y=0.5,
        showarrow=False,
        font=dict(size=16, color=text_color),
    )
    fig.update_layout(
        xaxis=dict(showgrid=False, showticklabels=False),
        yaxis=dict(showgrid=False, showticklabels=False),
        height=500,
        paper_bgcolor=bg_color,
        plot_bgcolor=bg_color,
    )
    return fig


def create_empty_network():
    """Create empty network placeholder"""
    fig = go.Figure()
    fig.add_annotation(
        text="Upload portfolio data to see strategy network",
        xref="paper",
        yref="paper",
        x=0.5,
        y=0.5,
        showarrow=False,
        font=dict(size=14, color="gray"),
    )
    fig.update_layout(
        xaxis=dict(showgrid=False, showticklabels=False),
        yaxis=dict(showgrid=False, showticklabels=False),
        height=300,
        plot_bgcolor="white",
    )
    return fig


def create_empty_network_with_threshold(threshold):
    """Create network with threshold message"""
    fig = go.Figure()
    fig.add_annotation(
        text=f"No correlations above threshold {threshold}<br>Try lowering the threshold",
        xref="paper",
        yref="paper",
        x=0.5,
        y=0.5,
        showarrow=False,
        font=dict(size=12, color="orange"),
    )
    fig.update_layout(
        xaxis=dict(showgrid=False, showticklabels=False),
        yaxis=dict(showgrid=False, showticklabels=False),
        height=300,
        plot_bgcolor="white",
    )
    return fig


def create_empty_analytics():
    """Create empty analytics content"""
    return dmc.Text(
        "Upload portfolio data to see correlation analytics", size="sm", c="dimmed", ta="center"
    )


def create_insufficient_data_heatmap():
    """Create insufficient data heatmap"""
    fig = go.Figure()
    fig.add_annotation(
        text="Insufficient data for correlation analysis<br>Need at least 2 strategies with minimum trades",
        xref="paper",
        yref="paper",
        x=0.5,
        y=0.5,
        showarrow=False,
        font=dict(size=14, color="orange"),
    )
    fig.update_layout(
        xaxis=dict(showgrid=False, showticklabels=False),
        yaxis=dict(showgrid=False, showticklabels=False),
        height=500,
        plot_bgcolor="white",
    )
    return fig


def create_insufficient_data_analytics():
    """Create insufficient data analytics"""
    return dmc.Alert(
        children="Insufficient data for analysis. Try reducing minimum trades or expanding time period.",
        color="orange",
        variant="light",
    )


def create_error_heatmap(error_msg):
    """Create error heatmap"""
    fig = go.Figure()
    fig.add_annotation(
        text=f"Error calculating correlations:<br>{error_msg}",
        xref="paper",
        yref="paper",
        x=0.5,
        y=0.5,
        showarrow=False,
        font=dict(size=12, color="red"),
    )
    fig.update_layout(
        xaxis=dict(showgrid=False, showticklabels=False),
        yaxis=dict(showgrid=False, showticklabels=False),
        height=500,
        plot_bgcolor="white",
    )
    return fig


def create_error_analytics(error_msg):
    """Create error analytics content"""
    return dmc.Alert(
        children=f"Error in correlation analysis: {error_msg}", color="red", variant="light"
    )


def calculate_strategy_correlations(trades_data, method="pearson"):
    """Calculate correlation matrix between strategies based on daily P/L"""
    import pandas as pd
    import numpy as np

    # Using pandas/numpy equivalents instead of scipy for smaller bundle size
    from collections import defaultdict

    # Group trades by strategy and date
    strategy_daily_pnl = defaultdict(lambda: defaultdict(float))

    for trade in trades_data:
        strategy = trade.get("strategy", "Unknown")
        date = trade.get("date_opened", "")
        pl = trade.get("pl", 0)

        if date and strategy:
            strategy_daily_pnl[strategy][date] += pl

    # Get all strategies with sufficient data (at least 10 trading days)
    strategies = [s for s in strategy_daily_pnl.keys() if len(strategy_daily_pnl[s]) >= 10]

    if len(strategies) < 2:
        return np.array([]), strategies

    # Get all unique dates
    all_dates = set()
    for strategy in strategies:
        all_dates.update(strategy_daily_pnl[strategy].keys())
    all_dates = sorted(list(all_dates))

    # Create matrix of daily P/L for each strategy
    strategy_matrix = []
    for strategy in strategies:
        daily_values = []
        for date in all_dates:
            daily_values.append(strategy_daily_pnl[strategy].get(date, 0))
        strategy_matrix.append(daily_values)

    # Calculate correlation matrix
    n_strategies = len(strategies)
    correlation_matrix = np.eye(n_strategies)

    for i in range(n_strategies):
        for j in range(i + 1, n_strategies):
            values_i = strategy_matrix[i]
            values_j = strategy_matrix[j]

            # Calculate correlation based on method using pandas/numpy
            if method == "pearson":
                if np.std(values_i) > 0 and np.std(values_j) > 0:
                    corr = np.corrcoef(values_i, values_j)[0, 1]
                else:
                    corr = 0
            elif method == "spearman":
                # Spearman correlation using pandas
                df_temp = pd.DataFrame({"x": values_i, "y": values_j})
                corr = df_temp.corr(method="spearman").iloc[0, 1]
            elif method == "kendall":
                # Kendall tau using pandas
                df_temp = pd.DataFrame({"x": values_i, "y": values_j})
                corr = df_temp.corr(method="kendall").iloc[0, 1]
            else:
                corr = np.corrcoef(values_i, values_j)[0, 1]

            correlation_matrix[i, j] = corr
            correlation_matrix[j, i] = corr

    return correlation_matrix, strategies


def _generate_short_strategy_labels(strategies, max_length=10):
    """Create compact, unique labels for strategies while keeping axes readable."""
    short_names = []
    used_labels = set()

    for idx, strategy in enumerate(strategies):
        # Replace punctuation with spaces so parts split cleanly, fallback to original if blank
        cleaned = re.sub(r"[^A-Za-z0-9\s]", " ", strategy or "")
        parts = [part for part in cleaned.split() if part]
        if not parts:
            parts = [strategy or f"Strategy{idx + 1}"]

        # Start with first two parts, up to max_length characters in total
        candidate = "".join(part[:3] for part in parts[:2])
        candidate = candidate[:max_length]
        if not candidate:
            candidate = ("".join(parts))[:max_length]
        if not candidate:
            candidate = f"Strategy{idx + 1}"

        part_count = 2
        base_candidate = candidate

        while candidate in used_labels:
            if part_count < len(parts):
                # Gradually add more parts until the label becomes unique
                part_count += 1
                candidate = "".join(part[:3] for part in parts[:part_count])
                candidate = candidate[:max_length]
                if not candidate:
                    candidate = ("".join(parts))[:max_length]
                if not candidate:
                    candidate = f"Strategy{idx + 1}"
                base_candidate = candidate
            else:
                # Append numeric suffix while respecting max_length
                suffix = 2
                # Ensure base_candidate always has something to trim from
                base_full = (
                    "".join(part[:3] for part in parts) or ("".join(parts)) or f"Strategy{idx + 1}"
                )
                base_full = base_full[:max_length] or f"Strategy{idx + 1}"

                while True:
                    available = max_length - len(str(suffix)) - 1  # account for hyphen
                    if available <= 0:
                        trimmed = ""
                    else:
                        trimmed = base_full[:available].rstrip("-")

                    candidate = f"{trimmed}-{suffix}" if trimmed else str(suffix)

                    if candidate not in used_labels:
                        break
                    suffix += 1
                break

        used_labels.add(candidate)
        short_names.append(candidate)

    return short_names


def create_correlation_heatmap_from_matrix(correlation_matrix, strategies, is_dark_mode=False):
    """Create large, readable correlation heatmap focused on clarity"""
    import plotly.graph_objects as go

    # Create very short strategy names for axis labels to prevent spillover
    short_strategies = _generate_short_strategy_labels(strategies)

    # Theme-based heatmap colors
    if is_dark_mode:
        colorscale = [
            [0.0, "#1e3a8a"],  # Strong negative - darker blue
            [0.25, "#3b82f6"],  # Weak negative - medium blue
            [0.5, "#374151"],  # Zero - dark gray
            [0.75, "#f87171"],  # Weak positive - light red
            [1.0, "#dc2626"],  # Strong positive - strong red
        ]
        text_color_heatmap = "#e5e7eb"
        colorbar_color = "#e5e7eb"
    else:
        colorscale = [
            [0.0, "#3d52a0"],  # Strong negative - dark blue
            [0.25, "#7888c0"],  # Weak negative - light blue
            [0.5, "#f8fafc"],  # Zero - very light gray instead of white
            [0.75, "#ff9999"],  # Weak positive - light red
            [1.0, "#cc0000"],  # Strong positive - dark red
        ]
        text_color_heatmap = "#111827"
        colorbar_color = "#111827"

    # Use a better color scheme with higher contrast
    fig = go.Figure(
        data=go.Heatmap(
            z=correlation_matrix,
            x=short_strategies,
            y=short_strategies,
            colorscale=colorscale,
            zmid=0,
            zmin=-1,
            zmax=1,
            text=np.round(correlation_matrix, 2),
            texttemplate="%{text}",
            textfont={
                "size": 14,
                "color": text_color_heatmap,
                "family": "Arial, sans-serif",
            },
            showscale=True,
            colorbar=dict(
                title="Correlation",
                titleside="right",
                thickness=20,
                len=0.8,
                tickfont=dict(size=12, color=colorbar_color),
                titlefont=dict(color=colorbar_color),
            ),
            # Use fixed decimal precision in hover text so tooltip matches on-cell value
            hovertemplate="<b>%{customdata}</b><br>Correlation: %{z:.2f}<extra></extra>",
            customdata=[
                [f"{strategies[i]} vs {strategies[j]}" for j in range(len(strategies))]
                for i in range(len(strategies))
            ],
        )
    )

    # Theme-based colors
    bg_color = "#1a1a1a" if is_dark_mode else "white"
    text_color = "#e0e0e0" if is_dark_mode else "#222"

    fig.update_layout(
        title="",
        xaxis=dict(
            tickangle=45,
            tickfont=dict(size=14, family="Arial, sans-serif", color=text_color, weight="bold"),
            side="bottom",
            tickmode="array",
            tickvals=list(range(len(short_strategies))),
            ticktext=short_strategies,
        ),
        yaxis=dict(
            tickfont=dict(size=14, family="Arial, sans-serif", color=text_color, weight="bold"),
            autorange="reversed",  # Start from top
            tickmode="array",
            tickvals=list(range(len(short_strategies))),
            ticktext=short_strategies,
        ),
        width=None,  # Let it fill container
        height=600,
        margin=dict(l=100, r=50, t=20, b=100),
        autosize=True,
        paper_bgcolor=bg_color,
        plot_bgcolor=bg_color,
    )

    return fig


def create_correlation_network_from_matrix(correlation_matrix, strategies):
    """Create simplified network graph from correlation matrix"""
    import plotly.graph_objects as go
    import numpy as np

    # Limit to top strategies for cleaner visualization
    if len(strategies) > 8:
        # Only show top 8 strategies by total correlation strength
        total_corr = np.sum(np.abs(correlation_matrix), axis=1)
        top_indices = np.argsort(total_corr)[-8:]
        strategies = [strategies[i] for i in top_indices]
        correlation_matrix = correlation_matrix[np.ix_(top_indices, top_indices)]

    n = len(strategies)
    if n < 2:
        # Return empty plot if not enough data
        fig = go.Figure()
        fig.add_annotation(
            text="Not enough strategies for network view",
            xref="paper",
            yref="paper",
            x=0.5,
            y=0.5,
            showarrow=False,
            font=dict(size=14, color="gray"),
        )
        fig.update_layout(
            xaxis=dict(showgrid=False, showticklabels=False),
            yaxis=dict(showgrid=False, showticklabels=False),
            height=400,
            plot_bgcolor="white",
        )
        return fig

    # Create simple circular layout
    angles = np.linspace(0, 2 * np.pi, n, endpoint=False)
    x_pos = np.cos(angles)
    y_pos = np.sin(angles)

    # Truncate strategy names
    short_strategies = [s[:10] + "..." if len(s) > 10 else s for s in strategies]

    # Only show very strong correlations (>0.5 or <-0.5)
    edge_x = []
    edge_y = []

    for i in range(n):
        for j in range(i + 1, n):
            corr = correlation_matrix[i, j]
            if abs(corr) > 0.5:  # Only very strong correlations
                edge_x.extend([x_pos[i], x_pos[j], None])
                edge_y.extend([y_pos[i], y_pos[j], None])

    fig = go.Figure()

    # Add edges if any
    if edge_x:
        fig.add_trace(
            go.Scatter(
                x=edge_x,
                y=edge_y,
                line=dict(width=3, color="orange"),
                hoverinfo="none",
                mode="lines",
                showlegend=False,
            )
        )

    # Add nodes
    fig.add_trace(
        go.Scatter(
            x=x_pos,
            y=y_pos,
            mode="markers+text",
            marker=dict(size=40, color="lightblue", line=dict(width=2, color="darkblue")),
            text=short_strategies,
            textposition="middle center",
            textfont=dict(size=10, color="darkblue"),
            hoverinfo="text",
            hovertext=strategies,
            showlegend=False,
        )
    )

    fig.update_layout(
        title="",
        showlegend=False,
        xaxis=dict(showgrid=False, zeroline=False, showticklabels=False, range=[-1.5, 1.5]),
        yaxis=dict(showgrid=False, zeroline=False, showticklabels=False, range=[-1.5, 1.5]),
        width=500,
        height=400,
        margin=dict(l=20, r=20, t=20, b=20),
        plot_bgcolor="white",
    )

    return fig


def create_correlation_analytics_from_matrix(correlation_matrix, strategies):
    """Create simplified analytics summary from correlation matrix"""
    import numpy as np

    # Find strongest positive and negative correlations
    np.fill_diagonal(correlation_matrix, np.nan)  # Ignore self-correlations

    strongest_corr = np.nanmax(correlation_matrix)
    weakest_corr = np.nanmin(correlation_matrix)
    avg_corr = np.nanmean(correlation_matrix)

    # Find strategy pairs - truncate names for display
    max_idx = np.unravel_index(np.nanargmax(correlation_matrix), correlation_matrix.shape)
    min_idx = np.unravel_index(np.nanargmin(correlation_matrix), correlation_matrix.shape)

    strongest_pair = f"{strategies[max_idx[0]]} ↔ {strategies[max_idx[1]]}"
    weakest_pair = f"{strategies[min_idx[0]]} ↔ {strategies[min_idx[1]]}"

    # Most diversified strategy (lowest average correlation)
    avg_correlations = np.nanmean(correlation_matrix, axis=1)
    most_diversified_idx = np.nanargmin(np.abs(avg_correlations))
    most_diversified = strategies[most_diversified_idx]

    return dmc.Stack(
        [
            dmc.Text("📊 Quick Analysis", size="lg", fw=600, c="orange"),
            dmc.Stack(
                [
                    dmc.Group(
                        [
                            dmc.Text("Strongest:", size="sm", c="green", fw=600),
                            dmc.Text(f"{strongest_corr:.2f}", size="lg", fw=700, c="green"),
                        ],
                        justify="space-between",
                    ),
                    dmc.Text(strongest_pair, size="xs", c="dimmed"),
                    dmc.Divider(),
                    dmc.Group(
                        [
                            dmc.Text("Weakest:", size="sm", c="red", fw=600),
                            dmc.Text(f"{weakest_corr:.2f}", size="lg", fw=700, c="red"),
                        ],
                        justify="space-between",
                    ),
                    dmc.Text(weakest_pair, size="xs", c="dimmed"),
                    dmc.Divider(),
                    dmc.Group(
                        [
                            dmc.Text("Average:", size="sm", c="gray.8", fw=600),
                            dmc.Text(f"{avg_corr:.2f}", size="lg", fw=700, c="gray.8"),
                        ],
                        justify="space-between",
                    ),
                    dmc.Text(f"{len(strategies)} strategies analyzed", size="xs", c="dimmed"),
                ],
                gap="xs",
            ),
        ],
        gap="sm",
    )


def create_insufficient_strategies_heatmap(is_dark_mode=False):
    """Create placeholder for insufficient strategies"""
    bg_color = "#1a1a1a" if is_dark_mode else "white"
    text_color = "#ff8c42" if is_dark_mode else "orange"

    import plotly.graph_objects as go

    fig = go.Figure()
    fig.add_annotation(
        text="Need at least 2 strategies with sufficient trades",
        xref="paper",
        yref="paper",
        x=0.5,
        y=0.5,
        showarrow=False,
        font=dict(size=16, color=text_color),
    )
    fig.update_layout(
        xaxis=dict(showgrid=False, showticklabels=False),
        yaxis=dict(showgrid=False, showticklabels=False),
        height=500,
        paper_bgcolor=bg_color,
        plot_bgcolor=bg_color,
    )
    return fig


def register_correlation_callbacks(app):
    """Register all correlation matrix callbacks"""

    @app.callback(
        [
            Output("correlation-heatmap", "figure"),
            Output("correlation-analytics-content", "children"),
        ],
        [
            Input("current-portfolio-data", "data"),
            Input("correlation-method", "value"),
            Input("theme-store", "data"),
        ],
        prevent_initial_call=False,
    )
    def update_correlation_analysis(portfolio_data, method, theme_data):
        """Update correlation analysis with simple heatmap and analytics"""
        # Determine current theme (prefer client-resolved value)
        is_dark_mode = False
        if theme_data and isinstance(theme_data, dict):
            current_theme = theme_data.get("resolved") or theme_data.get("theme", "light")
            is_dark_mode = current_theme == "dark"

        if not portfolio_data:
            return (
                create_empty_heatmap(is_dark_mode),
                dmc.Text(
                    "Upload portfolio data to see correlation analysis", c="dimmed", ta="center"
                ),
            )

        try:
            payload, _ = resolve_portfolio_payload(portfolio_data)
            trades_data = []
            if payload and isinstance(payload, dict):
                trades_data = payload.get("trades", [])
            elif isinstance(portfolio_data, list):
                # Fallback for legacy direct list inputs
                trades_data = portfolio_data

            if not trades_data:
                return (
                    create_empty_heatmap(is_dark_mode),
                    dmc.Text("No trades found in portfolio data", c="dimmed", ta="center"),
                )

            # Calculate strategy correlations using the actual trade data
            correlation_matrix, strategies = calculate_strategy_correlations(
                trades_data, method or "pearson"
            )

            if len(strategies) < 2:
                return (
                    create_insufficient_strategies_heatmap(is_dark_mode),
                    dmc.Text(
                        "Need at least 2 strategies with 10+ trading days to calculate correlations",
                        c="orange",
                        ta="center",
                    ),
                )

            # Create visualizations with real data
            heatmap = create_correlation_heatmap_from_matrix(
                correlation_matrix, strategies, is_dark_mode
            )
            analytics = create_correlation_analytics_from_matrix(correlation_matrix, strategies)

            return heatmap, analytics

        except Exception as e:
            logger.error(f"Error in correlation analysis: {str(e)}")
            return (
                create_empty_heatmap(is_dark_mode),
                dmc.Text(f"Error calculating correlations: {str(e)}", c="red", ta="center"),
            )
