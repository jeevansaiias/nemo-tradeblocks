"""
🔗 Correlation Matrix Tab - Advanced Strategy Relationship Analysis

A visually stunning and interactive correlation analysis page featuring:
- Dynamic correlation heatmaps with custom color schemes
- Network graph visualization of strategy relationships
- Correlation strength indicators and insights
- Interactive filtering and time period analysis
- Strategy cluster identification
"""

import dash_mantine_components as dmc
from dash import html, dcc
from dash_iconify import DashIconify
import plotly.graph_objects as go
import plotly.express as px
import numpy as np


def create_correlation_matrix_tab():
    """Create a simple, focused correlation matrix tab with large heatmap"""
    return dmc.Stack(
        children=[
            # Header with Title and Controls
            dmc.Group(
                [
                    dmc.Title("🔗 Strategy Correlation Matrix", order=2),
                    dmc.Group(
                        [
                            dmc.Text("Method:", size="sm", fw=500),
                            dmc.Select(
                                id="correlation-method",
                                placeholder="Method",
                                data=[
                                    {"value": "pearson", "label": "Pearson (Linear)"},
                                    {"value": "spearman", "label": "Spearman (Rank)"},
                                    {"value": "kendall", "label": "Kendall (Rank)"},
                                ],
                                value="pearson",
                                style={"width": "160px"},
                            ),
                        ],
                        gap="xs",
                        align="center",
                    ),
                ],
                justify="space-between",
                align="center",
                mb="md",
            ),
            # Explanation Section
            dmc.Alert(
                children=[
                    dmc.Stack(
                        [
                            dmc.Text("📊 What does this show?", fw=600, size="sm"),
                            dmc.Text(
                                "This correlation matrix shows how your trading strategies move together. Values range from -1 to +1:",
                                size="sm",
                            ),
                            dmc.List(
                                [
                                    dmc.ListItem(
                                        dmc.Text(
                                            "🟢 +1.0: Perfect positive correlation (strategies always move together)",
                                            size="xs",
                                        )
                                    ),
                                    dmc.ListItem(
                                        dmc.Text(
                                            "🔵 0.0: No correlation (strategies move independently)",
                                            size="xs",
                                        )
                                    ),
                                    dmc.ListItem(
                                        dmc.Text(
                                            "🔴 -1.0: Perfect negative correlation (strategies move opposite)",
                                            size="xs",
                                        )
                                    ),
                                ],
                                size="xs",
                                spacing="xs",
                            ),
                            dmc.Divider(),
                            dmc.Group(
                                [
                                    dmc.Badge("Pearson", color="blue", variant="light", size="xs"),
                                    dmc.Text(
                                        "Linear relationships (normal)", size="xs", c="dimmed"
                                    ),
                                    dmc.Badge(
                                        "Spearman/Kendall",
                                        color="orange",
                                        variant="light",
                                        size="xs",
                                    ),
                                    dmc.Text(
                                        "Rank-based (non-linear patterns)", size="xs", c="dimmed"
                                    ),
                                ],
                                gap="xs",
                                align="center",
                            ),
                        ],
                        gap="xs",
                    )
                ],
                color="blue",
                variant="light",
                mb="lg",
            ),
            # Large Correlation Heatmap with Overflow Control
            dmc.Paper(
                children=[
                    dcc.Graph(
                        id="correlation-heatmap",
                        style={"height": "600px", "width": "100%", "overflow": "hidden"},
                        config={
                            "displayModeBar": True,
                            "displaylogo": False,
                            "modeBarButtonsToRemove": [
                                "pan2d",
                                "select2d",
                                "lasso2d",
                                "autoScale2d",
                            ],
                            "responsive": True,
                        },
                    )
                ],
                p="md",
                radius="md",
                withBorder=True,
                style={"overflow": "hidden"},
            ),
            # Simple Summary Stats Below
            dmc.Paper(
                children=[
                    html.Div(
                        id="correlation-analytics-content",
                        children=[
                            dmc.Text(
                                "Load portfolio data to see correlation analysis",
                                c="dimmed",
                                ta="center",
                                py="xl",
                            )
                        ],
                    )
                ],
                p="md",
                radius="md",
                withBorder=True,
            ),
        ],
        gap="lg",
    )


def create_correlation_header():
    """Create the header with title, controls, and filters"""
    return dmc.Group(
        [
            # Title and Info
            dmc.Group(
                [
                    dmc.Title("🔗 Strategy Correlation Matrix", order=2),
                    dmc.Tooltip(
                        label="Analyze relationships between your trading strategies. Strong correlations (>0.7) may indicate redundancy, while negative correlations can provide diversification benefits.",
                        children=[DashIconify(icon="tabler:info-circle", width=20, color="gray")],
                        multiline=True,
                    ),
                ],
                gap="xs",
                align="center",
            ),
            # Controls
            dmc.Group(
                [
                    # Time Period Selector
                    dmc.Select(
                        id="correlation-time-period",
                        label="Analysis Period",
                        placeholder="Select period",
                        data=[
                            {"value": "all", "label": "All Time"},
                            {"value": "90d", "label": "Last 90 Days"},
                            {"value": "180d", "label": "Last 6 Months"},
                            {"value": "365d", "label": "Last Year"},
                            {"value": "custom", "label": "Custom Range"},
                        ],
                        value="all",
                        style={"width": "150px"},
                    ),
                    # Correlation Method
                    dmc.Select(
                        id="correlation-method",
                        label="Method",
                        placeholder="Correlation type",
                        data=[
                            {"value": "pearson", "label": "Pearson"},
                            {"value": "spearman", "label": "Spearman"},
                            {"value": "kendall", "label": "Kendall"},
                        ],
                        value="pearson",
                        style={"width": "120px"},
                    ),
                    # Minimum Trades Filter
                    dmc.NumberInput(
                        id="correlation-min-trades",
                        label="Min Trades",
                        placeholder="5",
                        value=5,
                        min=1,
                        max=100,
                        style={"width": "100px"},
                    ),
                    # Refresh Button
                    dmc.Button(
                        "Refresh",
                        id="correlation-refresh-btn",
                        variant="light",
                        color="blue",
                        leftSection=DashIconify(icon="tabler:refresh", width=16),
                    ),
                ],
                gap="md",
                align="end",
            ),
        ],
        justify="space-between",
        align="center",
        mb="lg",
    )


def create_correlation_insights_cards():
    """Create quick insight cards showing key correlation metrics"""
    return dmc.SimpleGrid(
        children=[
            create_metric_card(
                title="Strongest Correlation",
                value_id="strongest-correlation-value",
                subtitle_id="strongest-correlation-pair",
                icon="tabler:trending-up",
                color="green",
            ),
            create_metric_card(
                title="Weakest Correlation",
                value_id="weakest-correlation-value",
                subtitle_id="weakest-correlation-pair",
                icon="tabler:trending-down",
                color="blue",
            ),
            create_metric_card(
                title="Most Diversified",
                value_id="most-diversified-strategy",
                subtitle_id="most-diversified-desc",
                icon="tabler:network",
                color="orange",
            ),
            create_metric_card(
                title="Cluster Count",
                value_id="cluster-count",
                subtitle_id="cluster-desc",
                icon="tabler:circles",
                color="purple",
            ),
        ],
        cols=4,
        spacing="md",
        verticalSpacing="md",
        id="correlation-insights-grid",
    )


def create_metric_card(title, value_id, subtitle_id, icon, color):
    """Create a metric card with icon and values"""
    return dmc.Paper(
        children=[
            dmc.Group(
                [
                    DashIconify(icon=icon, width=24, color=color),
                    dmc.Stack(
                        [
                            dmc.Text(title, size="sm", c="dimmed"),
                            dmc.Text("--", id=value_id, size="xl", fw=700),
                            dmc.Text("--", id=subtitle_id, size="xs", c="dimmed"),
                        ],
                        gap="xs",
                        align="flex-start",
                    ),
                ],
                gap="md",
                align="center",
            )
        ],
        p="md",
        radius="md",
        withBorder=True,
        style={"height": "100px"},
    )


def create_heatmap_section():
    """Create the main correlation heatmap visualization"""
    return dmc.Paper(
        children=[
            dmc.Stack(
                [
                    # Header
                    dmc.Group(
                        [
                            dmc.Text("Correlation Heatmap", size="lg", fw=600),
                            dmc.Group(
                                [
                                    dmc.Switch(
                                        id="heatmap-show-values",
                                        label="Show Values",
                                        checked=True,
                                        size="sm",
                                    ),
                                    dmc.Select(
                                        id="heatmap-color-scheme",
                                        placeholder="Color",
                                        data=[
                                            {"value": "RdBu_r", "label": "Red-Blue"},
                                            {"value": "viridis", "label": "Viridis"},
                                            {"value": "coolwarm", "label": "Cool-Warm"},
                                            {"value": "plasma", "label": "Plasma"},
                                        ],
                                        value="RdBu_r",
                                        style={"width": "120px"},
                                    ),
                                ],
                                gap="sm",
                            ),
                        ],
                        justify="space-between",
                        align="center",
                    ),
                    # Heatmap Container
                    dmc.Container(
                        children=[
                            dcc.Graph(
                                id="correlation-heatmap",
                                config={"displayModeBar": True, "displaylogo": False},
                                style={"height": "500px"},
                            )
                        ],
                        fluid=True,
                        p=0,
                    ),
                    # Legend and Controls
                    dmc.Group(
                        [
                            dmc.Group(
                                [
                                    dmc.Badge("Strong: >0.7", color="red", variant="light"),
                                    dmc.Badge("Moderate: 0.3-0.7", color="yellow", variant="light"),
                                    dmc.Badge("Weak: <0.3", color="blue", variant="light"),
                                ],
                                gap="xs",
                            ),
                            dmc.ActionIcon(
                                DashIconify(icon="tabler:download", width=16),
                                id="download-heatmap-btn",
                                variant="light",
                                color="gray",
                            ),
                        ],
                        justify="space-between",
                    ),
                ],
                gap="md",
            )
        ],
        p="lg",
        radius="md",
        withBorder=True,
    )


def create_network_graph_section():
    """Create network graph showing strategy relationships"""
    return dmc.Paper(
        children=[
            dmc.Stack(
                [
                    # Header
                    dmc.Group(
                        [
                            dmc.Text("Strategy Network", size="lg", fw=600),
                            dmc.Tooltip(
                                label="Network shows strategies as nodes. Line thickness indicates correlation strength. Clusters suggest similar behavior patterns.",
                                children=[
                                    DashIconify(icon="tabler:help-circle", width=16, color="gray")
                                ],
                                multiline=True,
                            ),
                        ],
                        gap="xs",
                    ),
                    # Network Graph
                    dcc.Graph(
                        id="correlation-network-graph",
                        config={"displayModeBar": False, "displaylogo": False},
                        style={"height": "300px"},
                    ),
                    # Network Controls
                    dmc.Group(
                        [
                            dmc.Slider(
                                id="network-threshold",
                                min=0,
                                max=1,
                                step=0.1,
                                value=0.3,
                                marks=[
                                    {"value": 0, "label": "0"},
                                    {"value": 0.5, "label": "0.5"},
                                    {"value": 1, "label": "1"},
                                ],
                                style={"width": "200px"},
                            ),
                            dmc.Text("Correlation Threshold", size="sm", c="dimmed"),
                        ],
                        gap="sm",
                        align="center",
                    ),
                ],
                gap="md",
            )
        ],
        p="lg",
        radius="md",
        withBorder=True,
    )


def create_correlation_analytics():
    """Create analytics panel with correlation statistics"""
    return dmc.Paper(
        children=[
            dmc.Stack(
                [
                    dmc.Text("Quick Analytics", size="lg", fw=600),
                    # Analytics Content
                    html.Div(
                        id="correlation-analytics-content",
                        children=[
                            dmc.Text(
                                "Load portfolio data to see correlation analytics",
                                size="sm",
                                c="dimmed",
                                ta="center",
                                py="xl",
                            )
                        ],
                    ),
                ],
                gap="md",
            )
        ],
        p="lg",
        radius="md",
        withBorder=True,
    )


def create_detailed_analysis_section():
    """Create detailed analysis section with tables and insights"""
    return dmc.Paper(
        children=[
            dmc.Stack(
                [
                    # Header with Tabs
                    dmc.Tabs(
                        id="correlation-detail-tabs",
                        value="matrix",
                        children=[
                            dmc.TabsList(
                                [
                                    dmc.TabsTab(
                                        "Correlation Matrix",
                                        value="matrix",
                                        leftSection=DashIconify(icon="tabler:table", width=16),
                                    ),
                                    dmc.TabsTab(
                                        "Strategy Pairs",
                                        value="pairs",
                                        leftSection=DashIconify(icon="tabler:link", width=16),
                                    ),
                                    dmc.TabsTab(
                                        "Risk Insights",
                                        value="insights",
                                        leftSection=DashIconify(icon="tabler:bulb", width=16),
                                    ),
                                    dmc.TabsTab(
                                        "Export Data",
                                        value="export",
                                        leftSection=DashIconify(icon="tabler:download", width=16),
                                    ),
                                ]
                            ),
                            # Tab Panels
                            dmc.TabsPanel(children=[create_correlation_table()], value="matrix"),
                            dmc.TabsPanel(
                                children=[create_strategy_pairs_analysis()], value="pairs"
                            ),
                            dmc.TabsPanel(
                                children=[create_risk_insights_panel()], value="insights"
                            ),
                            dmc.TabsPanel(children=[create_export_panel()], value="export"),
                        ],
                    )
                ],
                gap="md",
            )
        ],
        p="lg",
        radius="md",
        withBorder=True,
    )


def create_correlation_table():
    """Create detailed correlation matrix table"""
    return dmc.Container(
        [
            dmc.Text("Detailed Correlation Matrix", size="md", fw=500, mb="md"),
            html.Div(
                id="correlation-table-container",
                children=[
                    dmc.Text(
                        "Load portfolio data to see correlation matrix",
                        size="sm",
                        c="dimmed",
                        ta="center",
                        py="xl",
                    )
                ],
            ),
        ],
        fluid=True,
    )


def create_strategy_pairs_analysis():
    """Create strategy pairs analysis panel"""
    return dmc.Container(
        [
            dmc.Text("Strategy Pair Analysis", size="md", fw=500, mb="md"),
            html.Div(
                id="strategy-pairs-container",
                children=[
                    dmc.Text(
                        "Load portfolio data to analyze strategy pairs",
                        size="sm",
                        c="dimmed",
                        ta="center",
                        py="xl",
                    )
                ],
            ),
        ],
        fluid=True,
    )


def create_risk_insights_panel():
    """Create risk insights panel"""
    return dmc.Container(
        [
            dmc.Text("Portfolio Risk Insights", size="md", fw=500, mb="md"),
            dmc.Stack(
                [
                    dmc.Alert(
                        children=[
                            dmc.Text("🎯 Diversification Tips", fw=600, mb="xs"),
                            html.Ul(
                                [
                                    html.Li(
                                        "Look for strategies with correlation < 0.3 for better diversification"
                                    ),
                                    html.Li(
                                        "Avoid overweighting highly correlated strategies (>0.7)"
                                    ),
                                    html.Li("Negative correlations can provide hedge benefits"),
                                    html.Li(
                                        "Monitor correlation stability over different time periods"
                                    ),
                                ]
                            ),
                        ],
                        color="blue",
                        variant="light",
                    ),
                    html.Div(id="risk-insights-content"),
                ],
                gap="md",
            ),
        ],
        fluid=True,
    )


def create_export_panel():
    """Create export options panel"""
    return dmc.Container(
        [
            dmc.Text("Export Correlation Data", size="md", fw=500, mb="md"),
            dmc.SimpleGrid(
                [
                    dmc.Button(
                        "Download CSV",
                        id="export-correlation-csv",
                        variant="outline",
                        leftSection=DashIconify(icon="tabler:file-type-csv", width=16),
                    ),
                    dmc.Button(
                        "Download JSON",
                        id="export-correlation-json",
                        variant="outline",
                        leftSection=DashIconify(icon="tabler:file-type-json", width=16),
                    ),
                    dmc.Button(
                        "Export Chart",
                        id="export-correlation-chart",
                        variant="outline",
                        leftSection=DashIconify(icon="tabler:chart-bar", width=16),
                    ),
                    dmc.Button(
                        "Generate Report",
                        id="export-correlation-report",
                        variant="filled",
                        color="blue",
                        leftSection=DashIconify(icon="tabler:report", width=16),
                    ),
                ],
                cols=4,
                spacing="md",
            ),
        ],
        fluid=True,
    )


def create_sample_heatmap():
    """Create a sample correlation heatmap for demonstration"""
    # Sample data for demonstration
    strategies = [
        "30DTE Fly",
        "Iron Condor",
        "Put Credit Spread",
        "Call Credit Spread",
        "Jade Lizard",
    ]

    # Generate sample correlation matrix
    np.random.seed(42)
    n = len(strategies)
    correlation_matrix = np.random.rand(n, n)
    correlation_matrix = (correlation_matrix + correlation_matrix.T) / 2  # Make symmetric
    np.fill_diagonal(correlation_matrix, 1)  # Perfect self-correlation

    # Create heatmap
    fig = go.Figure(
        data=go.Heatmap(
            z=correlation_matrix,
            x=strategies,
            y=strategies,
            colorscale="RdBu_r",
            zmid=0,
            text=np.round(correlation_matrix, 2),
            texttemplate="%{text}",
            textfont={"size": 12},
            hoverongaps=False,
            colorbar=dict(title="Correlation", titleside="right"),
        )
    )

    fig.update_layout(
        title="Strategy Correlation Matrix",
        xaxis_title="Strategies",
        yaxis_title="Strategies",
        font=dict(size=12),
        height=500,
        margin=dict(l=100, r=100, t=50, b=100),
    )

    return fig


def create_sample_network():
    """Create a sample network graph for demonstration"""
    strategies = ["30DTE Fly", "Iron Condor", "Put Spread", "Call Spread", "Jade Lizard"]

    # Sample network data
    import networkx as nx

    G = nx.Graph()

    # Add nodes
    for i, strategy in enumerate(strategies):
        G.add_node(i, label=strategy)

    # Add edges based on correlation strength
    edges = [(0, 1, 0.8), (0, 2, 0.4), (1, 3, 0.6), (2, 4, 0.3), (1, 4, 0.7)]
    for edge in edges:
        G.add_edge(edge[0], edge[1], weight=edge[2])

    # Get positions
    pos = nx.spring_layout(G, seed=42)

    # Create edge traces
    edge_x = []
    edge_y = []
    edge_info = []

    for edge in G.edges(data=True):
        x0, y0 = pos[edge[0]]
        x1, y1 = pos[edge[1]]
        edge_x.extend([x0, x1, None])
        edge_y.extend([y0, y1, None])
        edge_info.append(f"Correlation: {edge[2]['weight']:.2f}")

    # Create node traces
    node_x = []
    node_y = []
    node_text = []

    for node in G.nodes():
        x, y = pos[node]
        node_x.append(x)
        node_y.append(y)
        node_text.append(strategies[node])

    # Create figure
    fig = go.Figure()

    # Add edges
    fig.add_trace(
        go.Scatter(
            x=edge_x, y=edge_y, line=dict(width=2, color="#888"), hoverinfo="none", mode="lines"
        )
    )

    # Add nodes
    fig.add_trace(
        go.Scatter(
            x=node_x,
            y=node_y,
            mode="markers+text",
            hoverinfo="text",
            text=node_text,
            textposition="middle center",
            marker=dict(size=30, color="lightblue", line=dict(width=2, color="darkblue")),
        )
    )

    fig.update_layout(
        title="Strategy Relationship Network",
        showlegend=False,
        hovermode="closest",
        margin=dict(b=20, l=5, r=5, t=40),
        annotations=[
            dict(
                text="Node size represents strategy importance<br>Line thickness shows correlation strength",
                showarrow=False,
                xref="paper",
                yref="paper",
                x=0.005,
                y=-0.002,
                xanchor="left",
                yanchor="bottom",
                font=dict(color="gray", size=10),
            )
        ],
        xaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        yaxis=dict(showgrid=False, zeroline=False, showticklabels=False),
        height=300,
    )

    return fig
