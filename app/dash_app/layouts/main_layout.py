import dash_mantine_components as dmc
from dash import dcc, html
from dash_iconify import DashIconify
from app.dash_app.components.file_upload import create_upload_component


def create_main_layout():
    """Create the main application layout using DMC AppShell"""

    return dmc.AppShell(
        children=[
            # Header
            dmc.AppShellHeader(
                children=[
                    dmc.Group(
                        children=[
                            # Logo/Title
                            dmc.Group(
                                children=[
                                    html.Img(
                                        src="/assets/tradeblocks-logo.png",
                                        className="tb-logo",
                                        style={"height": "32px", "width": "auto"},
                                    ),
                                    dmc.Stack(
                                        [
                                            dmc.Text("TradeBlocks", size="lg", fw=700, c="blue.6"),
                                            dmc.Text(
                                                "Trading Analytics Platform", size="xs", c="dimmed"
                                            ),
                                        ],
                                        gap="0px",
                                    ),
                                ],
                                gap="sm",
                                align="center",
                            ),
                            # Center - NinjaTaco tribute
                            dmc.Group(
                                [
                                    dmc.Text(
                                        "Inspired by NinjaTaco", size="xs", c="orange.6", fw=500
                                    ),
                                    html.Img(
                                        src="/assets/ninjataco-tribute.png",
                                        style={"height": "24px", "width": "auto", "opacity": "0.7"},
                                    ),
                                ],
                                gap="xs",
                                align="center",
                            ),
                            # Right side items
                            dmc.Group(
                                children=[
                                    # Configuration indicators
                                    html.Div(id="config-indicators"),
                                    # Settings button with label
                                    dmc.Group(
                                        [
                                            dmc.Button(
                                                "Portfolio Settings",
                                                id="settings-button",
                                                leftSection=DashIconify(
                                                    icon="tabler:settings", width=16
                                                ),
                                                variant="light",
                                                color="blue",
                                                size="sm",
                                            ),
                                        ],
                                        gap="xs",
                                    ),
                                    # Theme toggle
                                    dmc.SegmentedControl(
                                        id="theme-toggle",
                                        value="light",
                                        data=[
                                            {
                                                "value": "light",
                                                "label": dmc.Center(
                                                    DashIconify(icon="tabler:sun", width=16),
                                                    style={"width": 40, "height": 28},
                                                ),
                                            },
                                            {
                                                "value": "dark",
                                                "label": dmc.Center(
                                                    DashIconify(icon="tabler:moon", width=16),
                                                    style={"width": 40, "height": 28},
                                                ),
                                            },
                                            {
                                                "value": "auto",
                                                "label": dmc.Center(
                                                    DashIconify(
                                                        icon="tabler:device-desktop", width=16
                                                    ),
                                                    style={"width": 40, "height": 28},
                                                ),
                                            },
                                        ],
                                        size="sm",
                                        radius="md",
                                    ),
                                ],
                                gap="sm",
                            ),
                        ],
                        justify="space-between",
                        w="100%",
                        px="md",
                        py="sm",
                    )
                ],
                h=60,
            ),
            # Navigation
            dmc.AppShellNavbar(
                children=[
                    dmc.ScrollArea(
                        children=[
                            dmc.Stack(
                                children=[
                                    # Portfolio info section
                                    html.Div(id="portfolio-section"),
                                    # Navigation items - TradeBlocks themed
                                    dmc.NavLink(
                                        label="🧱 Block Stats",
                                        leftSection=DashIconify(icon="tabler:chart-bar"),
                                        id="nav-geekistics",
                                        active=True,
                                        description="Block Stats & Analytics",
                                    ),
                                    dmc.NavLink(
                                        label="📈 Performance Blocks",
                                        leftSection=DashIconify(icon="tabler:chart-line"),
                                        id="nav-performance",
                                        description="Performance Analytics",
                                    ),
                                    dmc.NavLink(
                                        label="🎲 Risk Simulator",
                                        leftSection=DashIconify(icon="tabler:dice"),
                                        id="nav-monte-carlo",
                                        description="Risk Simulation",
                                    ),
                                    dmc.NavLink(
                                        label="🔗 Connection Matrix",
                                        leftSection=DashIconify(icon="tabler:grid-dots"),
                                        id="nav-correlation",
                                        description="Strategy Connections",
                                    ),
                                    dmc.NavLink(
                                        label="📊 Trade Blocks",
                                        leftSection=DashIconify(icon="tabler:table"),
                                        id="nav-trade-data",
                                        description="Trading Block History",
                                    ),
                                    dmc.NavLink(
                                        label="💰 Capital Blocks",
                                        leftSection=DashIconify(icon="tabler:percentage"),
                                        id="nav-margin",
                                        description="Capital Management",
                                    ),
                                    dmc.NavLink(
                                        label="🎯 Builder's Edge",
                                        leftSection=DashIconify(icon="tabler:target"),
                                        id="nav-optimizer",
                                        description="Portfolio Builder",
                                    ),
                                ],
                                gap="xs",
                                p="sm",
                            )
                        ]
                    )
                ],
                w=250,
            ),
            # Main content area
            dmc.AppShellMain(
                children=[
                    dmc.Container(
                        children=[
                            # Upload modal
                            dmc.Modal(
                                id="upload-modal",
                                title="🧱 Upload Your Trading Blocks",
                                size="lg",
                                children=[create_upload_component()],
                            ),
                            # Clear portfolio confirmation modal
                            dmc.Modal(
                                id="clear-confirm-modal",
                                title="🗑️ Clear Portfolio",
                                opened=False,
                                children=[
                                    dmc.Stack(
                                        [
                                            dmc.Text(
                                                "Are you sure you want to clear your portfolio data?",
                                                size="sm",
                                            ),
                                            dmc.Text(
                                                "This will permanently delete all your portfolio data from this browser.",
                                                size="xs",
                                                c="dimmed",
                                            ),
                                            dmc.Group(
                                                [
                                                    dmc.Button(
                                                        "Cancel",
                                                        id="clear-cancel-button",
                                                        variant="light",
                                                        color="gray",
                                                    ),
                                                    dmc.Button(
                                                        "Clear Portfolio",
                                                        id="clear-confirm-button",
                                                        color="red",
                                                    ),
                                                ],
                                                justify="flex-end",
                                                gap="sm",
                                            ),
                                        ],
                                        gap="md",
                                    )
                                ],
                            ),
                            # Portfolio settings modal
                            dmc.Modal(
                                id="settings-modal",
                                title="⚙️ Portfolio Configuration",
                                opened=False,
                                size="lg",
                                children=[html.Div(id="settings-modal-content")],
                            ),
                            # Main content
                            html.Div(
                                style={"position": "relative"},
                                children=[
                                    html.Div(id="main-content", children=create_welcome_content()),
                                    dmc.LoadingOverlay(id="loading-overlay", visible=False),
                                ],
                            ),
                        ],
                        size="xl",
                        p="md",
                    )
                ]
            ),
        ],
        header={"height": 60},
        navbar={"width": 250, "breakpoint": "sm", "collapsed": {"mobile": True}},
        padding="md",
    )


def create_welcome_content():
    """Create welcome content when no portfolio is loaded"""
    return dmc.Center(
        children=[
            dmc.Stack(
                children=[
                    html.Img(
                        src="/assets/tradeblocks-logo.png",
                        className="tb-logo",
                        style={"height": "150px", "width": "auto", "opacity": "0.8"},
                    ),
                    dmc.Title("Welcome to TradeBlocks", order=2, ta="center", c="blue.6"),
                    dmc.Title("Trading Analytics Platform", order=3, ta="center", c="dimmed"),
                    dmc.Text(
                        "🧱 Build smarter trades with powerful analytics, one block at a time! 📊",
                        size="lg",
                        ta="center",
                        c="dimmed",
                        style={"maxWidth": "500px"},
                    ),
                    dmc.Text(
                        "Upload your portfolio CSV to start building your foundation...",
                        size="md",
                        ta="center",
                        c="dimmed",
                    ),
                    dmc.Button(
                        "Start Building",
                        size="lg",
                        leftSection=DashIconify(icon="tabler:upload"),
                        id="welcome-upload-button",
                        color="blue",
                        variant="gradient",
                        gradient={"from": "orange", "to": "red"},
                    ),
                ],
                align="center",
                gap="xl",
            )
        ],
        style={"minHeight": "60vh"},
    )
