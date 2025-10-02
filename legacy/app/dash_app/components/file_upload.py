import dash_mantine_components as dmc
from dash import html, dcc
from dash_iconify import DashIconify


def create_upload_component(
    portfolio_data=None, daily_log_data=None, portfolio_filename=None, daily_log_filename=None
):
    """Create the dual file upload component with optional success states"""

    # Determine success states
    trade_success = portfolio_data is not None and portfolio_filename is not None
    daily_success = daily_log_data is not None and daily_log_filename is not None

    trade_success_info = None
    daily_success_info = None

    if trade_success:
        trade_success_info = {
            "filename": portfolio_filename.get("filename", "Trade Log"),
            "count": portfolio_filename.get("total_trades", 0),
            "type": "Trade Log",
        }

    if daily_success:
        daily_success_info = {
            "filename": daily_log_filename.get("filename", "Daily Log"),
            "count": daily_log_filename.get("total_entries", 0),
            "type": "Daily Log",
        }

    return dmc.Stack(
        children=[
            dmc.Text("Upload your OptionOmega CSV files for analysis", size="lg", fw=500),
            dmc.Alert(
                children=[
                    dmc.Group(
                        [
                            DashIconify(icon="tabler:info-circle", width=16),
                            dmc.Text(
                                "For more accurate metrics with individual backtests: Ensure 'Close Open Trades on Test Completion' is enabled in OptionOmega before exporting",
                                size="sm",
                            ),
                        ],
                        gap="xs",
                        align="flex-start",
                        wrap="nowrap",
                    )
                ],
                color="gray",
                variant="light",
                style={"marginBottom": "10px"},
            ),
            dmc.Alert(
                children=[
                    dmc.Group(
                        [
                            DashIconify(icon="tabler:alert-triangle", width=16),
                            dmc.Text(
                                "⚠️ Educational use only • Not financial advice • See footer for full disclaimer",
                                size="sm",
                                fw=500,
                            ),
                        ],
                        gap="xs",
                        align="flex-start",
                        wrap="nowrap",
                    )
                ],
                color="orange",
                variant="light",
                style={"marginBottom": "15px"},
            ),
            dmc.SimpleGrid(
                children=[
                    create_single_upload(
                        upload_id="portfolio-upload",
                        title="Trade Log",
                        description="Upload your portfolio trades CSV file",
                        feedback_id="trade-upload-feedback",
                        required=True,
                        show_success=trade_success,
                        success_info=trade_success_info,
                    ),
                    create_single_upload(
                        upload_id="daily-log-upload",
                        title="Daily Log",
                        description="Upload your daily performance CSV file",
                        feedback_id="daily-upload-feedback",
                        required=False,
                        show_success=daily_success,
                        success_info=daily_success_info,
                    ),
                ],
                cols=2,
                spacing="md",
                verticalSpacing="md",
            ),
            dmc.Group(
                children=[
                    dmc.Button(
                        "Done",
                        id="upload-done-button",
                        variant="filled",
                        color="gray",
                        size="md",
                        leftSection=DashIconify(icon="tabler:check", width=16),
                    )
                ],
                justify="flex-end",
                mt="md",
            ),
        ],
        gap="md",
    )


def create_single_upload(
    upload_id: str,
    title: str,
    description: str,
    feedback_id: str,
    required: bool = True,
    show_success: bool = False,
    success_info: dict = None,
):
    """Create a single upload area with optional success state"""

    # Determine upload area content
    if show_success and success_info:
        upload_content = create_upload_success_overlay(
            success_info["filename"], success_info["count"], success_info["type"]
        )
    else:
        upload_content = dmc.Center(
            children=[
                dmc.Stack(
                    children=[
                        DashIconify(icon="tabler:cloud-upload", width=48, height=48, color="gray"),
                        dmc.Text("Drag and drop or click to upload", size="sm", ta="center"),
                        dmc.Text("Supported format: CSV", size="xs", ta="center", c="dimmed"),
                    ],
                    align="center",
                    gap="sm",
                )
            ]
        )

    return dmc.Stack(
        children=[
            dmc.Group(
                children=[
                    dmc.Text(title, size="md", fw=500),
                    dmc.Badge(
                        "Required" if required else "Optional",
                        color="red" if required else "blue",
                        variant="light",
                        size="sm",
                    ),
                ],
                justify="space-between",
                align="center",
            ),
            dmc.Text(description, size="sm", c="dimmed"),
            dcc.Upload(
                id=upload_id,
                children=dmc.Paper(
                    children=[upload_content],
                    style={
                        "border": "2px dashed #ced4da" if not show_success else "2px solid #51cf66",
                        "borderRadius": "8px",
                        "padding": "30px",
                        "cursor": "pointer",
                        "transition": "border-color 0.2s",
                        "minHeight": "120px",
                        "display": "flex",
                        "alignItems": "center",
                        "justifyContent": "center",
                        "backgroundColor": "transparent",
                    },
                    className="upload-area",
                ),
                multiple=False,
                accept=".csv",
            ),
            html.Div(id=feedback_id),
        ],
        gap="sm",
    )


def create_upload_success_message(filename, trade_count, total_pl):
    """Create success message after upload"""
    return dmc.Alert(
        children=[
            dmc.Group(
                children=[
                    DashIconify(icon="tabler:check", width=20, height=20),
                    dmc.Stack(
                        children=[
                            dmc.Text(f"Successfully uploaded: {filename}", fw=500),
                            dmc.Text(
                                f"Loaded {trade_count} trades with total P/L: ${total_pl:,.2f}",
                                size="sm",
                            ),
                        ],
                        gap="xs",
                    ),
                ],
                gap="sm",
            )
        ],
        color="green",
        variant="light",
    )


def create_upload_error_message(error_msg):
    """Create error message for upload failures"""
    return dmc.Alert(
        children=[
            dmc.Group(
                children=[
                    DashIconify(icon="tabler:x", width=20, height=20),
                    dmc.Stack(
                        children=[
                            dmc.Text("Upload failed", fw=500),
                            dmc.Text(str(error_msg), size="sm"),
                        ],
                        gap="xs",
                    ),
                ],
                gap="sm",
            )
        ],
        color="red",
        variant="light",
    )


def create_upload_success_overlay(filename, count, file_type):
    """Create success overlay that goes over the upload area"""
    return dmc.Stack(
        children=[
            # Success indicator
            dmc.Center(
                children=[
                    dmc.Stack(
                        children=[
                            DashIconify(
                                icon="tabler:check-circle", width=32, height=32, color="green"
                            ),
                            dmc.Text(f"✅ {filename}", size="sm", ta="center", fw=500, c="green"),
                            dmc.Text(
                                (
                                    f"{count} {file_type.lower()} entries"
                                    if file_type == "Daily Log"
                                    else f"{count} trades"
                                ),
                                size="xs",
                                ta="center",
                                c="dimmed",
                            ),
                        ],
                        align="center",
                        gap="xs",
                    )
                ],
                style={
                    "backgroundColor": "rgba(81, 207, 102, 0.1)",
                    "border": "2px solid #51cf66",
                    "borderRadius": "8px",
                    "padding": "20px",
                    "marginBottom": "10px",
                },
            ),
            # Keep drag and drop text
            dmc.Text("Drag and drop or click to upload", size="sm", ta="center", c="dimmed"),
            dmc.Text("Supported format: CSV", size="xs", ta="center", c="dimmed"),
        ],
        align="center",
        gap="sm",
    )


def create_upload_loading_area(file_type):
    """Create loading upload area with spinner"""
    return dmc.Paper(
        children=[
            dmc.Center(
                children=[
                    dmc.Stack(
                        children=[
                            dmc.Loader(size="lg", variant="dots", color="gray"),
                            dmc.Text(
                                f"Processing {file_type}...",
                                size="sm",
                                ta="center",
                                fw=500,
                                c="gray.8",
                            ),
                            dmc.Text(
                                "Validating columns and parsing data",
                                size="xs",
                                ta="center",
                                c="dimmed",
                            ),
                        ],
                        align="center",
                        gap="sm",
                    )
                ]
            )
        ],
        style={
            "border": "2px solid #339af0",
            "borderRadius": "8px",
            "padding": "30px",
            "minHeight": "120px",
            "display": "flex",
            "alignItems": "center",
            "justifyContent": "center",
            "backgroundColor": "#f8f9fa",
        },
        className="upload-loading",
    )
