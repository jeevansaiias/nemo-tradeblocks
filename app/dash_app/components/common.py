"""
Common UI components and helpers for TradeBlocks
"""

import dash_mantine_components as dmc
from dash_iconify import DashIconify


def create_info_tooltip(title, content, detailed_content=None, tooltip_id=None):
    """
    Create an info icon with popover tooltip for charts and metrics.

    Matches the exact style used across TradeBlocks pages.

    Args:
        title: Blue header text (usually with emoji and title)
        content: Main description paragraph
        detailed_content: Optional gray flavor text at bottom
        tooltip_id: Optional ID for the tooltip icon

    Returns:
        dmc.HoverCard component with consistent styling
    """
    return dmc.HoverCard(
        width=350,
        shadow="md",
        position="bottom",
        withArrow=True,
        children=[
            dmc.HoverCardTarget(
                dmc.ActionIcon(
                    DashIconify(icon="tabler:info-circle", width=16),
                    size="sm",
                    variant="subtle",
                    color="gray",
                    **({"id": f"{tooltip_id}-info"} if tooltip_id else {}),
                )
            ),
            dmc.HoverCardDropdown(
                children=[
                    dmc.Stack(
                        [
                            dmc.Text(title, fw=600, size="sm", c="blue"),
                            dmc.Text(content, size="sm"),
                            dmc.Divider() if detailed_content else None,
                            (
                                dmc.Text(detailed_content, size="xs", c="dimmed")
                                if detailed_content
                                else None
                            ),
                        ],
                        gap="xs",
                    )
                ]
            ),
        ],
    )
