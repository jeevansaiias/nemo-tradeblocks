import dash
import dash_mantine_components as dmc
from dash import dcc, html
from flask import jsonify
from flask_cors import CORS

from app.dash_app.callbacks.portfolio_callbacks import register_callbacks
from app.dash_app.layouts.main_layout import create_main_layout


def create_dash_app():
    """Create and configure the Dash application"""

    # Initialize Dash app
    app = dash.Dash(
        __name__,
        external_stylesheets=[
            # Add any external stylesheets if needed
        ],
        suppress_callback_exceptions=True,
        title="TradeBlocks - Trading Analytics Platform",
        assets_folder="../assets",
        meta_tags=[
            {
                "name": "description",
                "content": "TradeBlocks - Professional Trading Analytics Platform",
            },
            {"name": "viewport", "content": "width=device-width, initial-scale=1"},
            {"property": "og:title", "content": "TradeBlocks - Trading Analytics Platform"},
            {
                "property": "og:description",
                "content": "Professional trading analytics and portfolio management",
            },
            {"property": "og:type", "content": "website"},
        ],
    )

    # Update favicon in index string
    app.index_string = """
    <!DOCTYPE html>
    <html>
        <head>
            {%metas%}
            <title>{%title%}</title>
            <link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png">
            <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32x32.png">
            <link rel="icon" type="image/png" sizes="16x16" href="/assets/favicon-16x16.png">
            <link rel="manifest" href="/assets/site.webmanifest">
            {%favicon%}
            {%css%}
        </head>
        <body>
            {%app_entry%}
            <footer>
                {%config%}
                {%scripts%}
                {%renderer%}
            </footer>
        </body>
    </html>
    """

    # Configure DMC theme - TradeBlocks themed
    app.layout = dmc.MantineProvider(
        theme={
            "colorScheme": "light",
            "primaryColor": "blue",
            "fontFamily": "'Inter', sans-serif",
            "colors": {
                "blocks": [
                    "#EBF4FF",
                    "#C3DAFE",
                    "#A3BFFA",
                    "#7C9CF9",
                    "#667EEA",
                    "#5A67D8",
                    "#4C51BF",
                    "#434190",
                    "#3C366B",
                    "#322659",
                ]
            },
            "components": {
                "Paper": {"defaultProps": {"shadow": "sm", "radius": "md"}},
                "Card": {"defaultProps": {"shadow": "sm", "radius": "md", "withBorder": True}},
                "Button": {"defaultProps": {"radius": "md"}},
                "ActionIcon": {"defaultProps": {"radius": "md"}},
            },
        },
        children=[
            # Global stores
            dcc.Store(id="portfolio-store", storage_type="session"),
            dcc.Store(id="current-portfolio-data", storage_type="local"),
            dcc.Store(id="portfolio-filename", storage_type="local"),
            dcc.Store(id="current-daily-log-data", storage_type="local"),
            dcc.Store(id="daily-log-filename", storage_type="local"),
            dcc.Store(id="theme-store", storage_type="local", data={"theme": "light"}),
            dcc.Store(id="system-theme-store", storage_type="memory"),
            # Hidden div for theme callback output
            html.Div(id="theme-output", style={"display": "none"}),
            # Main layout
            create_main_layout(),
            # Client-side script for system theme detection
            html.Script(
                """
                // Detect system theme preference
                function getSystemTheme() {
                    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                }

                // Listen for system theme changes
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
                    const systemTheme = e.matches ? 'dark' : 'light';
                    // Update the system theme store
                    if (window.dash_clientside) {
                        window.dash_clientside.set_props('system-theme-store', {'data': {'systemTheme': systemTheme}});
                    }
                });

                // Set initial system theme
                document.addEventListener('DOMContentLoaded', function() {
                    const systemTheme = getSystemTheme();
                    if (window.dash_clientside) {
                        window.dash_clientside.set_props('system-theme-store', {'data': {'systemTheme': systemTheme}});
                    }
                });
            """
            ),
        ],
    )

    # Register all callbacks
    register_callbacks(app)

    # Add CORS support to the underlying Flask app
    CORS(app.server)

    # Add API routes to the Flask server
    @app.server.route("/api/health")
    def health_check():
        return jsonify({"status": "healthy", "service": "portfolio-analysis"})

    @app.server.route("/api")
    def api_root():
        return jsonify({"message": "Portfolio Analysis API", "version": "1.0.0"})

    return app


# For development/testing
if __name__ == "__main__":
    app = create_dash_app()
    app.run(debug=True, port=8050)
