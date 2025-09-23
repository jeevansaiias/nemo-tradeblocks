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

    # Update favicon in index string with immediate theme detection
    app.index_string = """
    <!DOCTYPE html>
    <html data-mantine-color-scheme="auto">
        <head>
            {%metas%}
            <title>{%title%}</title>
            <style>
                /* Prevent initial white flash on desktop */
                @media (prefers-color-scheme: dark) {
                    html[data-mantine-color-scheme="auto"] { color-scheme: dark; background: #1a1a1a !important; }
                    html[data-mantine-color-scheme="auto"] body { background: #1a1a1a !important; }
                    html[data-mantine-color-scheme="auto"] #react-entry-point { background: #1a1a1a !important; }
                }
                @media (prefers-color-scheme: light) {
                    html[data-mantine-color-scheme="auto"] { color-scheme: light; background: #ffffff !important; }
                    html[data-mantine-color-scheme="auto"] body { background: #ffffff !important; }
                    html[data-mantine-color-scheme="auto"] #react-entry-point { background: #ffffff !important; }
                }
                html[data-mantine-color-scheme="dark"] body, html[data-mantine-color-scheme="dark"] #react-entry-point { background: #1a1a1a !important; }
                html[data-mantine-color-scheme="light"] body, html[data-mantine-color-scheme="light"] #react-entry-point { background: #ffffff !important; }
            </style>
            <script>
                // Apply theme ASAP (before CSS loads) to avoid flash
                (function() {
                    try {
                        var stored = {};
                        try { stored = JSON.parse(localStorage.getItem('theme-store') || '{}'); } catch (_) {}
                        var pref = stored.theme || 'auto';

                        // Resolve 'auto' to actual scheme immediately
                        var actual = pref;
                        if (pref === 'auto') {
                            actual = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                        }

                        var root = document.documentElement;
                        root.setAttribute('data-mantine-color-scheme', actual);
                        root.style.setProperty('--mantine-color-scheme', actual);
                        // Hint to the UA for built‑in controls
                        root.style.colorScheme = actual;
                        // Force immediate backdrop color before CSS parses
                        root.style.background = (actual === 'dark' ? '#1a1a1a' : '#ffffff');

                        // Persist a resolved value so server-side chart theming is correct
                        try {
                            stored.theme = pref; // keep preference ('auto' allowed)
                            stored.resolved = actual; // concrete 'dark' or 'light'
                            localStorage.setItem('theme-store', JSON.stringify(stored));
                        } catch (_) {}

                        // Add a quick body class as soon as body exists
                        var applyBodyClass = function() {
                            if (!document.body) return;
                            var cls = document.body.className || '';
                            cls = cls.replace(/\btheme-(dark|light|auto)\b/g, '').trim();
                            document.body.className = (cls + ' theme-' + actual).trim();
                            document.body.style.backgroundColor = (actual === 'dark' ? '#1a1a1a' : '#ffffff');
                            document.removeEventListener('DOMContentLoaded', applyBodyClass);
                        };
                        if (document.readyState === 'loading') {
                            document.addEventListener('DOMContentLoaded', applyBodyClass);
                        } else {
                            applyBodyClass();
                        }
                    } catch (e) {
                        // Ignore; Dash callback will correct later
                    }
                })();
            </script>
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
            dcc.Store(id="theme-store", storage_type="local", data={"theme": "auto"}),
            # Hidden div for theme callback output
            html.Div(id="theme-output", style={"display": "none"}),
            # Main layout
            create_main_layout(),
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
