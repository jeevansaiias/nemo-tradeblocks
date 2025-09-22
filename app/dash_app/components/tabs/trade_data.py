import dash_mantine_components as dmc
from dash import html, dcc, dash_table
from dash_iconify import DashIconify
import pandas as pd


def create_trade_data_tab():
    """Create the Trade Data tab"""
    return dmc.Stack(
        children=[
            # Header with title and controls
            dmc.Group(
                children=[
                    # Title
                    dmc.Group(
                        children=[
                            dmc.Title("📊 Trading Block History", order=2),
                        ],
                        gap="sm",
                        align="center",
                    ),
                    # Controls
                    dmc.Group(
                        children=[
                            dmc.Select(
                                id="trade-strategy-filter",
                                label="Strategy",
                                data=[],
                                placeholder="All strategies",
                                clearable=True,
                                style={"width": "200px"},
                                leftSection=DashIconify(icon="tabler:filter", width=16),
                            ),
                        ],
                        gap="md",
                        align="flex-end",
                    ),
                ],
                justify="space-between",
                align="flex-end",
                mb="lg",
            ),
            # Summary stats
            dmc.Paper(
                children=[
                    dmc.Group(
                        id="trade-summary-stats",
                        justify="space-around",
                        align="center",
                        w="100%",
                        children=[],
                    )
                ],
                p="md",
                withBorder=True,
            ),
            # Data table
            dmc.Paper(children=[html.Div(id="trades-table-container")], p="md", withBorder=True),
            # Download component (hidden)
            dcc.Download(id="download-trades-csv"),
        ],
        gap="lg",
    )


def create_trades_table(trades_data):
    """Create the trades data table"""
    if not trades_data:
        return dmc.Center(
            dmc.Text("No trade data available", c="dimmed"), style={"height": "200px"}
        )

    # Convert to DataFrame for easier manipulation
    df = pd.DataFrame(trades_data)

    # Select and format columns for display
    display_columns = [
        "date_opened",
        "strategy",
        "legs",
        "premium",
        "pl",
        "num_contracts",
        "margin_req",
        "reason_for_close",
    ]

    # Filter columns that exist in the data
    available_columns = [col for col in display_columns if col in df.columns]
    df_display = df[available_columns].copy()

    # Format numeric columns
    numeric_columns = ["premium", "pl", "margin_req"]
    for col in numeric_columns:
        if col in df_display.columns:
            df_display[col] = df_display[col].apply(lambda x: f"${x:,.2f}" if pd.notna(x) else "")

    # Format date columns
    if "date_opened" in df_display.columns:
        df_display["date_opened"] = pd.to_datetime(df_display["date_opened"]).dt.strftime(
            "%Y-%m-%d"
        )

    # Rename columns for better display
    column_rename = {
        "date_opened": "Date Opened",
        "strategy": "Strategy",
        "legs": "Legs",
        "premium": "Premium",
        "pl": "P/L",
        "num_contracts": "Contracts",
        "margin_req": "Margin Req",
        "reason_for_close": "Close Reason",
    }

    df_display = df_display.rename(columns=column_rename)

    # Create Dash DataTable
    return dash_table.DataTable(
        id="trades-table",
        data=df_display.to_dict("records"),
        columns=[{"name": col, "id": col, "type": "text"} for col in df_display.columns],
        page_size=20,
        page_action="native",
        sort_action="native",
        filter_action="native",
        style_table={"overflowX": "auto", "minWidth": "100%"},
        style_cell={
            "textAlign": "left",
            "padding": "10px",
            "fontFamily": "Inter, sans-serif",
            "fontSize": "14px",
        },
        style_header={
            "backgroundColor": "#f8f9fa",
            "fontWeight": "bold",
            "border": "1px solid #dee2e6",
        },
        style_data={"border": "1px solid #dee2e6", "whiteSpace": "normal", "height": "auto"},
        style_data_conditional=[
            {"if": {"row_index": "odd"}, "backgroundColor": "#f8f9fa"},
            {"if": {"filter_query": "{P/L} contains -", "column_id": "P/L"}, "color": "#d63384"},
            {
                "if": {"filter_query": '{P/L} > 0 && {P/L} != ""', "column_id": "P/L"},
                "color": "#198754",
            },
        ],
        tooltip_data=[
            {column: {"value": str(value), "type": "markdown"} for column, value in row.items()}
            for row in df_display.to_dict("records")
        ],
        tooltip_duration=None,
    )


def create_trade_summary_stats(trades_data):
    """Create summary statistics for trades"""
    if not trades_data:
        return []

    total_trades = len(trades_data)
    total_pl = sum(trade.get("pl", 0) for trade in trades_data)
    winning_trades = sum(1 for trade in trades_data if trade.get("pl", 0) > 0)
    win_rate = (winning_trades / total_trades * 100) if total_trades > 0 else 0
    total_premium = sum(abs(trade.get("premium", 0)) for trade in trades_data)

    return [
        create_summary_stat("Total Trades", f"{total_trades:,}", "tabler:list"),
        create_summary_stat(
            "Total P/L",
            f"${total_pl:,.2f}",
            "tabler:currency-dollar",
            color="green" if total_pl >= 0 else "red",
        ),
        create_summary_stat("Win Rate", f"{win_rate:.1f}%", "tabler:percentage"),
        create_summary_stat("Total Premium", f"${total_premium:,.2f}", "tabler:coins"),
    ]


def create_summary_stat(label, value, icon, color="gray"):
    """Create a summary statistic component - matches Performance Blocks style"""
    return dmc.Stack(
        children=[
            dmc.Text(label, size="xs", c="dimmed", ta="center"),
            dmc.Text(value, size="lg", fw=700, c=color, ta="center"),
            html.Div(),  # Empty div to match Performance Blocks 3-element structure
        ],
        gap="xs",
        align="center",
    )


def split_trade_legs(trades_data):
    """Split multi-leg trades into individual legs (simplified implementation)"""
    # This is a simplified version - in production you'd want more sophisticated leg parsing
    split_trades = []

    for trade in trades_data:
        legs_str = trade.get("legs", "")

        # Simple split by '|' - each leg becomes a separate row
        if "|" in legs_str:
            legs = legs_str.split("|")
            for i, leg in enumerate(legs):
                split_trade = trade.copy()
                split_trade["legs"] = leg.strip()
                split_trade["leg_number"] = i + 1
                # Distribute P/L evenly across legs (simplified)
                split_trade["pl"] = trade.get("pl", 0) / len(legs)
                split_trades.append(split_trade)
        else:
            split_trades.append(trade)

    return split_trades
