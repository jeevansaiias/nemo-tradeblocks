import dash_mantine_components as dmc
from dash import html
from dash_iconify import DashIconify


def create_settings_modal_content(config_data=None):
    """Create the analysis settings modal content"""
    if config_data is None:
        config_data = {
            "risk_free_rate": 2.0,
            "use_business_days_only": True,
            "annualization_factor": 252,
            "confidence_level": 0.95,
            "drawdown_threshold": 0.05
        }

    return dmc.Stack([
        # Analysis Parameters
        dmc.Stack([
            dmc.Text("📊 Analysis Parameters", size="lg", fw=600, c="orange.5"),

            dmc.SimpleGrid([
                dmc.NumberInput(
                    id="settings-risk-free-rate",
                    label="Risk-Free Rate (%)",
                    description="Annual risk-free rate for Sharpe/Sortino calculations",
                    value=config_data.get("risk_free_rate", 2.0),
                    min=0.0,
                    max=20,
                    step=0.1,
                    suffix="%",
                    leftSection=DashIconify(icon="tabler:chart-line"),
                ),
            ], cols=1, spacing="md"),
        ], gap="sm"),

        dmc.Divider(style={"margin": "16px 0"}),

        # Time Calculations
        dmc.Stack([
            dmc.Text("⏰ Time Calculations", size="lg", fw=600, c="orange.5"),

            dmc.SimpleGrid([
                dmc.Switch(
                    id="settings-use-business-days-only",
                    label="Use Business Days Only",
                    description="Use only business days for time calculations",
                    checked=config_data.get("use_business_days_only", True),
                    size="md",
                ),
                dmc.NumberInput(
                    id="settings-annualization-factor",
                    label="Annualization Factor",
                    description="Days per year (252 for business, 365 for calendar)",
                    value=config_data.get("annualization_factor", 252),
                    min=200,
                    max=365,
                    step=1,
                    leftSection=DashIconify(icon="tabler:calendar"),
                ),
            ], cols=2, spacing="md"),
        ], gap="sm"),

        dmc.Divider(style={"margin": "16px 0"}),

        # Advanced Analysis
        dmc.Stack([
            dmc.Text("🔬 Advanced Analysis", size="lg", fw=600, c="orange.5"),

            dmc.SimpleGrid([
                dmc.NumberInput(
                    id="settings-confidence-level",
                    label="Confidence Level",
                    description="Confidence level for VaR and risk metrics",
                    value=config_data.get("confidence_level", 0.95),
                    min=0.8,
                    max=0.99,
                    step=0.01,
                    leftSection=DashIconify(icon="tabler:target"),
                ),
                dmc.NumberInput(
                    id="settings-drawdown-threshold",
                    label="Drawdown Threshold",
                    description="Minimum drawdown % to consider significant",
                    value=config_data.get("drawdown_threshold", 0.05),
                    min=0.01,
                    max=0.5,
                    step=0.01,
                    leftSection=DashIconify(icon="tabler:trending-down"),
                ),
            ], cols=2, spacing="md"),
        ], gap="sm"),

        dmc.Divider(style={"margin": "16px 0"}),

        # Action buttons
        dmc.Group([
            dmc.Button(
                "Reset to Defaults",
                id="settings-reset-button",
                variant="light",
                color="gray",
                leftSection=DashIconify(icon="tabler:refresh"),
            ),
            dmc.Group([
                dmc.Button(
                    "Cancel",
                    id="settings-cancel-button",
                    variant="light",
                    color="gray"
                ),
                dmc.Button(
                    "Save Settings",
                    id="settings-save-button",
                    color="orange",
                    leftSection=DashIconify(icon="tabler:check"),
                )
            ], gap="sm")
        ], justify="space-between"),

    ], gap="lg")


def create_config_indicator(config_data, initial_capital=None):
    """Create a small indicator showing current analysis configuration"""
    if not config_data:
        return None

    risk_free_rate = config_data.get("risk_free_rate", 2.0)
    annualization_factor = config_data.get("annualization_factor", 252)

    badges = []

    # Add initial capital if available
    if initial_capital is not None:
        badges.append(
            dmc.Badge(
                f"${initial_capital:,.0f}",
                variant="light",
                color="blue",
                size="sm"
            )
        )

    # Add other config badges
    badges.extend([
        dmc.Badge(
            f"RFR: {risk_free_rate}%",
            variant="light",
            color="green",
            size="sm"
        ),
        dmc.Badge(
            f"{annualization_factor}d",
            variant="light",
            color="orange",
            size="sm"
        ),
    ])

    return dmc.Group(badges, gap="xs")