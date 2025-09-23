"""
Theme utilities for consistent dark/light mode styling across charts.
"""


def get_theme_colors(theme_data):
    """
    Get theme-appropriate colors based on current theme state.

    Args:
        theme_data: Theme data from Dash callback input

    Returns:
        dict: Theme colors including bg_color, text_color, grid_color
    """
    # Determine current theme
    is_dark_mode = False
    if theme_data and isinstance(theme_data, dict):
        # Prefer a concrete, client-resolved value if present
        current_theme = theme_data.get("resolved") or theme_data.get("theme", "light")
        is_dark_mode = current_theme == "dark"

    if is_dark_mode:
        return {
            "bg_color": "#1a1a1a",
            "text_color": "#e0e0e0",
            "grid_color": "rgba(128,128,128,0.2)",
            "is_dark_mode": True,
        }
    else:
        return {
            "bg_color": "white",
            "text_color": "#222",
            "grid_color": "rgba(128,128,128,0.3)",
            "is_dark_mode": False,
        }


def apply_theme_layout(fig, theme_colors, **kwargs):
    """
    Apply consistent theme styling to a Plotly figure.

    Args:
        fig: Plotly figure object
        theme_colors: Colors from get_theme_colors()
        **kwargs: Additional layout properties
    """
    # Set hover label styling based on theme
    if theme_colors.get("is_dark_mode"):
        hoverlabel_style = {
            "bgcolor": "#2a2a2a",
            "font": {"color": "#e0e0e0", "size": 13},
            "bordercolor": "#404040",
        }
    else:
        hoverlabel_style = {
            "bgcolor": "white",
            "font": {"color": "#222", "size": 13},
            "bordercolor": "#d0d0d0",
        }

    base_layout = {
        "paper_bgcolor": "rgba(0,0,0,0)",  # Transparent, let container handle background
        "plot_bgcolor": "rgba(0,0,0,0)",  # Transparent, let container handle background
        "font": {"color": theme_colors["text_color"]},
        "xaxis": {
            "showgrid": True,
            "gridcolor": theme_colors["grid_color"],
        },
        "yaxis": {
            "showgrid": True,
            "gridcolor": theme_colors["grid_color"],
        },
        "hoverlabel": hoverlabel_style,
    }

    # Deep merge axis settings to preserve grid settings
    if "xaxis" in kwargs:
        base_layout["xaxis"].update(kwargs["xaxis"])
        kwargs["xaxis"] = base_layout["xaxis"]
    if "yaxis" in kwargs:
        base_layout["yaxis"].update(kwargs["yaxis"])
        kwargs["yaxis"] = base_layout["yaxis"]

    # Merge with any additional kwargs
    base_layout.update(kwargs)

    fig.update_layout(**base_layout)
    return fig
