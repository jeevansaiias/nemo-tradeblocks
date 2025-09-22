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
                                        src="/assets/recreate-this-tradeblocks-logo-on-a-clean-white-background-k.png",
                                        className="tb-logo",
                                        style={"height": "32px", "width": "auto"},
                                    ),
                                    dmc.Stack(
                                        [
                                            dmc.Text("TradeBlocks", size="lg", fw=700),
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
                            # Right side items
                            dmc.Group(
                                children=[
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
                                        id="nav-geekistics",
                                        active=True,
                                        description="Block Stats & Analytics",
                                    ),
                                    dmc.NavLink(
                                        label="📈 Performance Blocks",
                                        id="nav-performance",
                                        description="Performance Analytics",
                                    ),
                                    dmc.NavLink(
                                        label="🎲 Risk Simulator",
                                        id="nav-monte-carlo",
                                        description="Risk Simulation",
                                    ),
                                    dmc.NavLink(
                                        label="🔗 Correlation Matrix",
                                        id="nav-correlation",
                                        description="Strategy Correlations",
                                    ),
                                    dmc.NavLink(
                                        label="📊 Trade Blocks",
                                        id="nav-trade-data",
                                        description="Trading Block History",
                                    ),
                                    dmc.NavLink(
                                        label="💰 Capital Blocks",
                                        id="nav-margin",
                                        description="Capital Management",
                                    ),
                                    dmc.NavLink(
                                        label="⏰ Time Machine",
                                        id="nav-optimizer",
                                        description="Walk-Forward Analysis",
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
            # Footer
            dmc.AppShellFooter(
                children=[
                    dmc.Container(
                        children=[
                            dmc.Group(
                                children=[
                                    # Left side - Warning and disclaimer
                                    dmc.Group(
                                        children=[
                                            dmc.Text(
                                                "⚠️ Educational use only • Not financial advice • Trading involves risk",
                                                size="xs",
                                                c="dimmed",
                                            ),
                                            dmc.Text("•", size="xs", c="dimmed"),
                                            dmc.Button(
                                                "Full Disclaimer",
                                                id="disclaimer-link",
                                                variant="subtle",
                                                size="xs",
                                                color="orange",
                                                style={
                                                    "padding": "0",
                                                    "height": "auto",
                                                    "minHeight": "auto",
                                                },
                                            ),
                                        ],
                                        gap="xs",
                                        align="center",
                                    ),
                                    # Center - Tagline
                                    dmc.Text(
                                        "TradeBlocks builds insights, not investment advice",
                                        size="xs",
                                        c="dimmed",
                                        style={"fontStyle": "italic"},
                                    ),
                                    # Right side - Credits and links
                                    dmc.Group(
                                        children=[
                                            # NinjaTaco tribute
                                            dmc.Anchor(
                                                children=[
                                                    dmc.Group(
                                                        [
                                                            dmc.Text(
                                                                "Inspired by NinjaTaco",
                                                                size="xs",
                                                                c="orange.6",
                                                                fw=500,
                                                            ),
                                                            html.Img(
                                                                src="/assets/ninjataco-tribute.png",
                                                                style={
                                                                    "height": "16px",
                                                                    "width": "auto",
                                                                    "opacity": "0.7",
                                                                },
                                                            ),
                                                        ],
                                                        gap="4px",
                                                        align="center",
                                                    )
                                                ],
                                                href="https://ninjata.co/",
                                                target="_blank",
                                                style={"textDecoration": "none"},
                                            ),
                                            dmc.Text("•", size="xs", c="dimmed"),
                                            # GitHub link
                                            dmc.Anchor(
                                                children=[
                                                    dmc.Group(
                                                        [
                                                            DashIconify(
                                                                icon="tabler:brand-github", width=14
                                                            ),
                                                            dmc.Text(
                                                                "GitHub", size="xs", c="gray.6"
                                                            ),
                                                        ],
                                                        gap="4px",
                                                        align="center",
                                                    )
                                                ],
                                                href="https://github.com/davidromeo/tradeblocks",
                                                target="_blank",
                                                style={"textDecoration": "none"},
                                            ),
                                        ],
                                        gap="xs",
                                        align="center",
                                    ),
                                ],
                                justify="space-between",
                                align="center",
                                w="100%",
                            )
                        ],
                        size="xl",
                        p="sm",
                    )
                ],
                h=50,
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
                            # Disclaimer modal
                            dmc.Modal(
                                id="disclaimer-modal",
                                title="⚠️ Important Disclaimer",
                                opened=False,
                                size="lg",
                                children=[create_disclaimer_content()],
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
        footer={"height": 50},
        padding="md",
    )


def create_welcome_content():
    """Create welcome content when no portfolio is loaded"""
    return dmc.Center(
        children=[
            dmc.Stack(
                children=[
                    html.Img(
                        src="/assets/recreate-this-tradeblocks-logo-on-a-clean-white-background-k.png",
                        className="tb-logo",
                        style={"height": "150px", "width": "auto", "opacity": "0.8"},
                    ),
                    dmc.Title("Welcome to TradeBlocks", order=2, ta="center"),
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
                        color="gray",
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


def create_disclaimer_content():
    """Create the full disclaimer content for the modal"""
    return dmc.Stack(
        children=[
            dmc.Alert(
                children=[
                    dmc.Text(
                        "🧱 Important Legal Notice - Please Read Before Building Your Analytics",
                        fw=600,
                        size="sm",
                    )
                ],
                color="orange",
                variant="light",
                mb="md",
            ),
            dmc.Stack(
                children=[
                    dmc.Text(
                        "Educational & Research Purposes Only",
                        fw=600,
                        size="md",
                        c="red.6",
                    ),
                    dmc.Text(
                        "TradeBlocks is designed for educational exploration and research analysis of trading strategies. Nothing within this platform constitutes investment advice, trading recommendations, or financial guidance of any kind.",
                        size="sm",
                    ),
                ],
                gap="xs",
                mb="md",
            ),
            dmc.Stack(
                children=[
                    dmc.Text("Your Data, Your Responsibility", fw=600, size="md", c="orange.6"),
                    dmc.Text(
                        "All calculations, metrics, and insights are generated from the historical data you provide. We make no guarantees about data accuracy, completeness, or the validity of your trading logs. Quality analysis requires quality data — imperfect inputs will produce unreliable results.",
                        size="sm",
                    ),
                ],
                gap="xs",
                mb="md",
            ),
            dmc.Stack(
                children=[
                    dmc.Text("Software & Technical Limitations", fw=600, size="md", c="blue.6"),
                    dmc.Text(
                        "Like all software, TradeBlocks may contain errors, bugs, or unexpected behaviors. Our algorithms make assumptions that may not align with your specific trading circumstances. Historical performance analysis cannot predict future market outcomes.",
                        size="sm",
                    ),
                ],
                gap="xs",
                mb="md",
            ),
            dmc.Stack(
                children=[
                    dmc.Text("Financial Risk Acknowledgment", fw=600, size="md", c="red.7"),
                    dmc.Text(
                        "Trading and investing carry substantial risk of loss. You may lose part or all of your investment capital. Before making any financial decisions, consult with qualified financial professionals who understand your individual situation.",
                        size="sm",
                    ),
                ],
                gap="xs",
                mb="md",
            ),
            dmc.Stack(
                children=[
                    dmc.Text("Privacy & Data Handling", fw=600, size="md", c="gray.7"),
                    dmc.Text(
                        "TradeBlocks operates entirely in your browser using local storage and session cookies to maintain your data and preferences. We do not transmit, store, or access your trading data on external servers.",
                        size="sm",
                    ),
                ],
                gap="xs",
                mb="md",
            ),
            dmc.Alert(
                children=[
                    dmc.Text(
                        "🧱 Remember: TradeBlocks builds insights, not investment advice.",
                        fw=700,
                        ta="center",
                        size="md",
                        style={"fontStyle": "italic"},
                    )
                ],
                color="gray",
                variant="filled",
                mt="md",
            ),
        ],
        gap="sm",
    )


def create_coming_soon_content():
    """Create coming soon content for features under development"""
    return dmc.Center(
        children=[
            dmc.Stack(
                children=[
                    # Large dice icon
                    dmc.Center(
                        dmc.Text("🎲", size="120px", style={"lineHeight": "1", "fontSize": "120px"})
                    ),
                    dmc.Title("🛠️ Building in Progress", order=2, ta="center", c="orange.6"),
                    dmc.Title("Risk Simulator Coming Soon", order=3, ta="center", c="dimmed"),
                    dmc.Text(
                        "We're crafting powerful risk simulation blocks to help you stress-test your trading strategies!",
                        size="lg",
                        ta="center",
                        c="dimmed",
                        style={"maxWidth": "600px"},
                    ),
                    dmc.Stack(
                        children=[
                            dmc.Paper(
                                children=[
                                    dmc.Text("🎲 Planned Features:", fw=600, size="md", mb="sm"),
                                    dmc.List(
                                        children=[
                                            dmc.ListItem(
                                                "Monte Carlo simulation with multiple scenarios"
                                            ),
                                            dmc.ListItem(
                                                "Portfolio stress testing under extreme market conditions"
                                            ),
                                            dmc.ListItem(
                                                "Risk metrics and Value at Risk (VaR) calculations"
                                            ),
                                            dmc.ListItem("Drawdown probability analysis"),
                                        ],
                                        spacing="xs",
                                        size="sm",
                                        c="dimmed",
                                    ),
                                ],
                                p="md",
                                withBorder=True,
                                radius="md",
                                style={"maxWidth": "500px"},
                            ),
                            dmc.Text(
                                "Check back soon - we're laying these blocks as fast as we can! 🧱",
                                size="md",
                                ta="center",
                                c="orange.6",
                                fw=500,
                                mt="md",
                            ),
                        ],
                        align="center",
                        gap="md",
                    ),
                ],
                align="center",
                gap="xl",
            )
        ],
        style={"minHeight": "60vh"},
    )


def create_capital_blocks_coming_soon():
    """Create coming soon content for Capital Blocks margin analysis tool"""
    return dmc.Center(
        children=[
            dmc.Stack(
                children=[
                    # Large money bag icon
                    dmc.Center(
                        dmc.Text("💰", size="120px", style={"lineHeight": "1", "fontSize": "120px"})
                    ),
                    dmc.Title("💰 Building Capital Blocks", order=2, ta="center", c="orange.6"),
                    dmc.Title(
                        "Margin Analysis Tools Coming Soon", order=3, ta="center", c="dimmed"
                    ),
                    dmc.Text(
                        "We're constructing powerful margin analysis blocks to help you optimize your capital efficiency!",
                        size="lg",
                        ta="center",
                        c="dimmed",
                        style={"maxWidth": "600px"},
                    ),
                    dmc.Stack(
                        children=[
                            dmc.Paper(
                                children=[
                                    dmc.Text("💼 Planned Features:", fw=600, size="md", mb="sm"),
                                    dmc.List(
                                        children=[
                                            dmc.ListItem(
                                                "Margin utilization analysis and optimization"
                                            ),
                                            dmc.ListItem(
                                                "Capital efficiency metrics across strategies"
                                            ),
                                            dmc.ListItem("Buying power allocation insights"),
                                            dmc.ListItem(
                                                "Position sizing based on available margin"
                                            ),
                                            dmc.ListItem(
                                                "Risk-adjusted capital deployment analysis"
                                            ),
                                        ],
                                        spacing="xs",
                                        size="sm",
                                        c="dimmed",
                                    ),
                                ],
                                p="md",
                                withBorder=True,
                                radius="md",
                                style={"maxWidth": "500px"},
                            ),
                            dmc.Text(
                                "Stay tuned - we're building these capital blocks with precision! 💎",
                                size="md",
                                ta="center",
                                c="orange.6",
                                fw=500,
                                mt="md",
                            ),
                        ],
                        align="center",
                        gap="md",
                    ),
                ],
                align="center",
                gap="xl",
            )
        ],
        style={"minHeight": "60vh"},
    )


def create_walk_forward_coming_soon():
    """Create coming soon content for Walk-Forward Analysis tool"""
    return dmc.Center(
        children=[
            dmc.Stack(
                children=[
                    dmc.Center(
                        dmc.Text("⏰", size="120px", style={"lineHeight": "1", "fontSize": "120px"})
                    ),
                    dmc.Title(
                        "⏰ Time Machine Under Construction", order=2, ta="center", c="orange.6"
                    ),
                    dmc.Title(
                        "Walk-Forward Analysis Coming Soon", order=3, ta="center", c="dimmed"
                    ),
                    dmc.Text(
                        "Travel through your trading history to see how your strategies evolved over time",
                        ta="center",
                        size="lg",
                        c="dimmed",
                        w=600,
                    ),
                    dmc.Stack(
                        children=[
                            dmc.Paper(
                                children=[
                                    dmc.Text("⏰ Planned Features:", fw=600, size="md", mb="sm"),
                                    dmc.List(
                                        children=[
                                            dmc.ListItem(
                                                "Rolling performance windows across time periods"
                                            ),
                                            dmc.ListItem(
                                                "Strategy stability analysis and regime detection"
                                            ),
                                            dmc.ListItem("Out-of-sample performance validation"),
                                            dmc.ListItem(
                                                "Temporal correlation insights between strategies"
                                            ),
                                            dmc.ListItem(
                                                "Historical pattern recognition in your trading blocks"
                                            ),
                                        ],
                                        spacing="xs",
                                        size="sm",
                                        c="dimmed",
                                    ),
                                ],
                                p="md",
                                withBorder=True,
                                radius="md",
                                style={"maxWidth": "500px"},
                            ),
                            dmc.Text(
                                "Perfect your foundation first - then we'll build your time machine! ⚡",
                                size="md",
                                ta="center",
                                c="orange.6",
                                fw=500,
                                mt="md",
                            ),
                        ],
                        align="center",
                        gap="md",
                    ),
                ],
                align="center",
                gap="xl",
            )
        ],
        style={"minHeight": "60vh"},
    )
