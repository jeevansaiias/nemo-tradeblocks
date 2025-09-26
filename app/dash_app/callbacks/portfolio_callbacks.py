from dash import Input, Output, State, callback, html, ctx, no_update
from dash.exceptions import PreventUpdate
import dash_mantine_components as dmc
from dash_iconify import DashIconify
import base64
import logging
import uuid
import json
import math
from datetime import datetime, date, time, timedelta
from decimal import Decimal

import numpy as np
from app.data.models import Trade
from pydantic import BaseModel
from app.dash_app.layouts.main_layout import (
    create_welcome_content,
    create_main_layout,
    create_coming_soon_content,
    create_capital_blocks_coming_soon,
    create_walk_forward_coming_soon,
)
from app.dash_app.components.file_upload import (
    create_upload_success_message,
    create_upload_error_message,
)
from app.dash_app.components.tabs.geekistics import (
    create_geekistics_tab,
)
from app.dash_app.components.tabs.performance_charts import (
    create_performance_charts_tab,
    get_mock_charts,
    get_mock_metrics,
    generate_performance_charts,
    create_metric_indicator,
    create_equity_curve_chart,
    create_drawdown_chart,
    create_day_of_week_distribution_chart,
    create_rom_distribution_chart,
    create_streak_distribution_chart,
    create_monthly_heatmap_chart,
    create_trade_sequence_chart,
    create_rom_timeline_chart,
    create_rolling_metrics_chart,
    create_risk_evolution_chart,
    generate_real_metrics,
    generate_streak_statistics_group,
)
from app.dash_app.components.tabs.trade_data import (
    create_trade_data_tab,
    create_trades_table,
    create_trade_summary_stats,
)
from app.dash_app.components.tabs.correlation_matrix import (
    create_correlation_matrix_tab,
)
from app.dash_app.components.tabs.risk_simulator import (
    create_risk_simulator_tab,
)
from app.dash_app.components.tabs.position_sizing import (
    create_position_sizing_tab,
)

from app.services.portfolio_cache import portfolio_cache
from app.services.portfolio_service import (
    calculate_advanced_stats_dict,
    calculate_portfolio_stats_dict,
    calculate_strategy_stats_dict,
    calculate_trades_dict,
    process_daily_log_upload,
    process_portfolio_upload,
    resolve_portfolio_payload,
    resolve_daily_log_payload,
    build_filtered_portfolio_payload,
)

logger = logging.getLogger(__name__)


def _jsonify_for_store(value):
    """Convert values to JSON-serialisable structures for dcc.Store."""

    if value is None:
        return None

    if isinstance(value, (str, bool)):
        return value

    if isinstance(value, (int, float)):
        if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
            return None
        return value

    if isinstance(value, Decimal):
        return float(value)

    if isinstance(value, (datetime, date)):
        return value.isoformat()

    if isinstance(value, time):
        return value.isoformat()

    if isinstance(value, timedelta):
        return value.total_seconds()

    if isinstance(value, BaseModel):
        try:
            return _jsonify_for_store(value.model_dump(mode="json"))
        except TypeError:
            return _jsonify_for_store(value.model_dump())

    # NumPy scalars
    if isinstance(value, np.generic):
        return _jsonify_for_store(value.item())

    if isinstance(value, (list, tuple)):
        return [_jsonify_for_store(item) for item in value]

    if isinstance(value, set):
        return [_jsonify_for_store(item) for item in value]

    if isinstance(value, dict):
        return {key: _jsonify_for_store(val) for key, val in value.items()}

    if isinstance(value, np.ndarray):
        return _jsonify_for_store(value.tolist())

    if hasattr(value, "tolist"):
        try:
            return _jsonify_for_store(value.tolist())
        except Exception:  # pragma: no cover - fallback
            pass

    return value


def register_callbacks(app):
    """Register all callbacks for the application"""

    # Import and register correlation callbacks
    from app.dash_app.callbacks.correlation_callbacks import register_correlation_callbacks
    from app.dash_app.callbacks.monte_carlo_callbacks import register_monte_carlo_callbacks
    from app.dash_app.callbacks.position_sizing_callbacks import register_position_sizing_callbacks

    register_correlation_callbacks(app)
    register_monte_carlo_callbacks(app)
    register_position_sizing_callbacks(app)

    # Use clientside callback to update MantineProvider theme
    app.clientside_callback(
        """
        function(theme_toggle_value) {
            console.log('Theme callback triggered:');
            console.log('  theme_toggle_value:', theme_toggle_value);

            // Function to apply theme
            function applyTheme(actual_theme) {
                console.log('  applying theme:', actual_theme);

                // Update Mantine theme
                const root = document.documentElement;
                root.setAttribute('data-mantine-color-scheme', actual_theme);

                // Update CSS custom property for proper theme switching
                root.style.setProperty('--mantine-color-scheme', actual_theme);

                // Apply theme classes to body for additional styling if needed
                document.body.className = document.body.className.replace(/theme-\\w+/g, '') + ' theme-' + actual_theme;
            }

            // Determine current theme preference
            let current_theme = theme_toggle_value || "auto";
            console.log('  current_theme:', current_theme);

            // Handle auto mode - detect system preference directly
            let actual_theme = current_theme;
            if (current_theme === "auto") {
                // Detect system theme preference directly
                const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                actual_theme = systemPrefersDark ? "dark" : "light";
                console.log('  auto mode - system prefers dark:', systemPrefersDark);
                console.log('  auto mode - using theme:', actual_theme);

                // Set up listener for system theme changes (only once)
                if (!window.themeChangeListenerSet) {
                    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
                        // Only react if we're in auto mode
                        const currentStored = JSON.parse(localStorage.getItem('theme-store') || '{}');
                        if ((currentStored.theme || 'auto') === 'auto') {
                            const newTheme = e.matches ? 'dark' : 'light';
                            console.log('System theme changed to:', newTheme);
                            applyTheme(newTheme);
                        }
                    });
                    window.themeChangeListenerSet = true;
                }
            }

            console.log('  final actual_theme:', actual_theme);
            applyTheme(actual_theme);

            return actual_theme;
        }
        """,
        Output("theme-output", "children"),  # Use hidden div as dummy output
        [Input("theme-toggle", "value")],
        prevent_initial_call=False,
    )

    # Keep theme-store up to date with a concrete 'resolved' value
    # so server-side charts can style correctly even when preference is 'auto'.
    app.clientside_callback(
        """
        function(actual_theme, theme_toggle_value, current) {
            if (!actual_theme) { return window.dash_clientside.no_update; }
            var next = Object.assign({}, current || {});
            var pref = theme_toggle_value || 'auto';
            var changed = false;
            if (next.resolved !== actual_theme) { next.resolved = actual_theme; changed = true; }
            if (next.theme !== pref) { next.theme = pref; changed = true; }
            if (!changed) { return window.dash_clientside.no_update; }
            return next;
        }
        """,
        Output("theme-store", "data"),
        [Input("theme-output", "children"), Input("theme-toggle", "value")],
        State("theme-store", "data"),
        prevent_initial_call=True,
    )

    # Removed store<->toggle cycle to avoid circular dependencies.

    @app.callback(
        Output("portfolio-section", "children"),
        [
            Input("current-portfolio-data", "data"),
            Input("portfolio-filename", "data"),
            Input("current-daily-log-data", "data"),
            Input("daily-log-filename", "data"),
        ],
        prevent_initial_call=False,
    )
    def update_portfolio_section(
        portfolio_data, filename_data, daily_log_data, daily_log_filename_data
    ):
        """Update portfolio section based on whether portfolio is loaded"""
        if portfolio_data and filename_data:
            # Portfolio is loaded - show info
            filename = filename_data.get("filename", "Unknown")
            total_trades = filename_data.get("total_trades", 0)

            # Check if daily log is also loaded
            daily_log_info = []
            if daily_log_data and daily_log_filename_data:
                daily_filename = daily_log_filename_data.get("filename", "Unknown")
                daily_entries = daily_log_filename_data.get("total_entries", 0)
                daily_log_info.extend(
                    [
                        dmc.Text("Daily Log:", size="xs", c="green.6", fw=500),
                        dmc.Text(daily_filename, size="xs", c="dimmed", style={"fontWeight": 600}),
                        dmc.Text(
                            f"{daily_entries} daily entries",
                            size="xs",
                            c="dimmed",
                        ),
                    ]
                )

            return dmc.Paper(
                children=[
                    dmc.Stack(
                        [
                            dmc.Text("🧱 Active Blocks", size="sm", fw=500),
                            dmc.Text("Trade Log:", size="xs", c="blue.6", fw=500),
                            dmc.Text(filename, size="xs", c="dimmed", style={"fontWeight": 600}),
                            dmc.Text(
                                f"{total_trades} trades",
                                size="xs",
                                c="dimmed",
                            ),
                            *daily_log_info,
                            dmc.Group(
                                children=[
                                    dmc.Button(
                                        "📁 Change Files",
                                        id="change-files-button",
                                        variant="subtle",
                                        color="gray",
                                        size="xs",
                                    ),
                                    dmc.Button(
                                        "🗑️ Clear All",
                                        id="clear-portfolio-button",
                                        variant="subtle",
                                        color="red",
                                        size="xs",
                                    ),
                                ],
                                gap="xs",
                                style={"marginTop": "8px"},
                            ),
                        ],
                        gap="xs",
                    )
                ],
                p="sm",
                m="sm",
                withBorder=True,
            )
        else:
            # No portfolio - show upload button
            return dmc.Paper(
                children=[
                    dmc.Stack(
                        children=[
                            dmc.Text("🧱 No Blocks Loaded", size="sm", fw=500, c="dimmed"),
                            dmc.Button(
                                "Upload Portfolio",
                                id="upload-button",
                                leftSection=DashIconify(icon="tabler:upload"),
                                variant="light",
                                color="gray",
                                size="sm",
                                fullWidth=True,
                            ),
                        ],
                        gap="xs",
                    )
                ],
                p="sm",
                m="sm",
                withBorder=True,
            )

    # Simple callback just for the Done button
    @app.callback(
        Output("upload-modal", "opened"),
        [Input("upload-done-button", "n_clicks")],
        prevent_initial_call=True,
    )
    def close_modal_on_done(done_clicks):
        """Close modal when Done button is clicked"""
        if done_clicks:
            return False
        return no_update

    # Callback for change-files-button to open modal
    @app.callback(
        Output("upload-modal", "opened", allow_duplicate=True),
        [Input("change-files-button", "n_clicks")],
        prevent_initial_call=True,
    )
    def open_modal_for_change_files(change_clicks):
        """Open upload modal when change files button is clicked"""
        if change_clicks:
            return True
        return no_update

    # Separate callbacks for upload buttons (when they exist)
    @app.callback(
        Output("upload-modal", "opened", allow_duplicate=True),
        [Input("upload-button", "n_clicks")],
        [State("upload-modal", "opened")],
        prevent_initial_call=True,
    )
    def open_modal_from_upload_button(upload_clicks, modal_opened):
        """Open upload modal from upload button"""
        if upload_clicks:
            return not modal_opened
        return no_update

    @app.callback(
        Output("upload-modal", "opened", allow_duplicate=True),
        [Input("welcome-upload-button", "n_clicks")],
        [State("upload-modal", "opened")],
        prevent_initial_call=True,
    )
    def open_modal_from_welcome_button(welcome_clicks, modal_opened):
        """Open upload modal from welcome button"""
        if welcome_clicks:
            return not modal_opened
        return no_update

    # Clear feedback when change files button is clicked
    @app.callback(
        [
            Output("trade-upload-feedback", "children", allow_duplicate=True),
            Output("daily-upload-feedback", "children", allow_duplicate=True),
        ],
        [Input("change-files-button", "n_clicks")],
        prevent_initial_call=True,
    )
    def clear_feedback_on_change(change_clicks):
        """Clear feedback messages when change files button is clicked"""
        if change_clicks:
            return "", ""
        return no_update, no_update

    # Update upload modal content based on current data state
    @app.callback(
        Output("upload-modal", "children", allow_duplicate=True),
        [
            Input("upload-modal", "opened"),
            Input("current-portfolio-data", "data"),
            Input("current-daily-log-data", "data"),
            Input("portfolio-filename", "data"),
            Input("daily-log-filename", "data"),
        ],
        prevent_initial_call=True,
    )
    def update_upload_modal_content(
        modal_opened, portfolio_data, daily_log_data, portfolio_filename, daily_log_filename
    ):
        """Update upload modal content to show success states when data is loaded"""
        if modal_opened:
            from app.dash_app.components.file_upload import create_upload_component

            return create_upload_component(
                portfolio_data=portfolio_data,
                daily_log_data=daily_log_data,
                portfolio_filename=portfolio_filename,
                daily_log_filename=daily_log_filename,
            )
        return no_update

    @app.callback(
        [
            Output("current-portfolio-data", "data"),
            Output("portfolio-filename", "data"),
            Output("trade-upload-feedback", "children"),
            Output("portfolio-upload-cache", "data", allow_duplicate=True),
            Output("portfolio-client-meta", "data", allow_duplicate=True),
        ],
        [Input("portfolio-upload", "contents")],
        [
            State("portfolio-upload", "filename"),
            State("portfolio-client-meta", "data"),
        ],
        prevent_initial_call=True,
    )
    def upload_portfolio(contents, filename, meta_state):
        """Handle trade log file upload"""
        if contents is None:
            return no_update, no_update, "", no_update, no_update

        try:
            # Decode the file contents
            content_type, content_string = contents.split(",")
            decoded = base64.b64decode(content_string)
            file_content = decoded.decode("utf-8")

            result = process_portfolio_upload(file_content, filename)
            portfolio_ref = {"portfolio_id": result["portfolio_id"], "schema": "v2"}

            success_msg = create_upload_success_message(
                filename, result["total_trades"], result["total_pl"]
            )

            filename_data = {"filename": filename, "total_trades": result["total_trades"]}

            meta_state = meta_state or {}
            client_key = meta_state.get("client_key") or str(uuid.uuid4())
            saved_at = datetime.utcnow().isoformat() + "Z"
            upload_cache_payload = {
                "client_key": client_key,
                "filename": filename,
                "csv_base64": content_string,
                "portfolio_id": result["portfolio_id"],
                "summary": {
                    "total_trades": result["total_trades"],
                    "total_pl": result["total_pl"],
                    "upload_timestamp": result.get("upload_timestamp"),
                },
                "saved_at": saved_at,
            }

            updated_meta = {
                **meta_state,
                "client_key": client_key,
                "rehydrated": True,
                "last_portfolio_id": result["portfolio_id"],
                "last_saved_at": saved_at,
            }

            return portfolio_ref, filename_data, success_msg, upload_cache_payload, updated_meta

        except Exception as e:
            logger.error(f"Error uploading trade log file: {str(e)}")
            return (
                no_update,
                no_update,
                create_upload_error_message(str(e)),
                no_update,
                no_update,
            )

    @app.callback(
        [
            Output("current-daily-log-data", "data"),
            Output("daily-log-filename", "data"),
            Output("daily-upload-feedback", "children"),
            Output("daily-log-upload", "children"),
            Output("daily-log-upload-cache", "data", allow_duplicate=True),
            Output("portfolio-client-meta", "data", allow_duplicate=True),
        ],
        [Input("daily-log-upload", "contents")],
        [
            State("daily-log-upload", "filename"),
            State("current-portfolio-data", "data"),
            State("portfolio-client-meta", "data"),
        ],
        prevent_initial_call=True,
    )
    def upload_daily_log(contents, filename, portfolio_ref, meta_state):
        """Handle daily log file upload"""
        if contents is None:
            return no_update, no_update, "", no_update, no_update, no_update

        try:
            # Decode the file contents
            content_type, content_string = contents.split(",")
            decoded = base64.b64decode(content_string)
            file_content = decoded.decode("utf-8")

            portfolio_id = None
            if isinstance(portfolio_ref, dict):
                portfolio_id = portfolio_ref.get("portfolio_id")

            result = process_daily_log_upload(file_content, filename, portfolio_id=portfolio_id)

            success_msg = dmc.Alert(
                children=[
                    dmc.Group(
                        children=[
                            DashIconify(icon="tabler:check", width=20, height=20),
                            dmc.Stack(
                                children=[
                                    dmc.Text(f"Successfully uploaded: {filename}", fw=500),
                                    dmc.Text(
                                        f"Loaded {result['total_entries']} daily entries", size="sm"
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

            if portfolio_id:
                daily_log_data = {"portfolio_id": portfolio_id, "schema": "v2"}
            else:
                daily_log_data = result["daily_log_data"]
            filename_data = {"filename": filename, "total_entries": result["total_entries"]}

            meta_state = meta_state or {}
            client_key = meta_state.get("client_key") or str(uuid.uuid4())
            saved_at = datetime.utcnow().isoformat() + "Z"
            upload_cache_payload = {
                "client_key": client_key,
                "filename": filename,
                "csv_base64": content_string,
                "portfolio_id": portfolio_id,
                "summary": {
                    "total_entries": result["total_entries"],
                    "date_range_start": result["date_range_start"],
                    "date_range_end": result["date_range_end"],
                },
                "saved_at": saved_at,
            }

            updated_meta = {
                **meta_state,
                "client_key": client_key,
                "has_daily_log": True,
                "last_daily_log_saved_at": saved_at,
            }

            return (
                daily_log_data,
                filename_data,
                success_msg,
                no_update,
                upload_cache_payload,
                updated_meta,
            )

        except Exception as e:
            logger.error(f"Error uploading daily log file: {str(e)}")
            return (
                no_update,
                no_update,
                create_upload_error_message(str(e)),
                no_update,
                no_update,
                no_update,
            )

    @app.callback(
        [
            Output("current-portfolio-data", "data", allow_duplicate=True),
            Output("portfolio-filename", "data", allow_duplicate=True),
            Output("trade-upload-feedback", "children", allow_duplicate=True),
            Output("portfolio-upload-cache", "data", allow_duplicate=True),
            Output("portfolio-client-meta", "data", allow_duplicate=True),
            Output("portfolio-rehydrate-payload", "data", allow_duplicate=True),
            Output("current-daily-log-data", "data", allow_duplicate=True),
            Output("daily-log-filename", "data", allow_duplicate=True),
            Output("daily-upload-feedback", "children", allow_duplicate=True),
            Output("daily-log-upload", "children", allow_duplicate=True),
            Output("daily-log-upload-cache", "data", allow_duplicate=True),
        ],
        Input("portfolio-rehydrate-payload", "data"),
        State("portfolio-client-meta", "data"),
        prevent_initial_call=True,
    )
    def rehydrate_portfolio(rehydrate_payload, meta_state):
        """Rehydrate portfolio/daily log from IndexedDB payload"""
        if not rehydrate_payload:
            raise PreventUpdate

        try:
            portfolio_section = rehydrate_payload.get("portfolio") or {}
            csv_base64 = portfolio_section.get("csv_base64")
            filename = portfolio_section.get("filename", "portfolio.csv")
            client_key = rehydrate_payload.get("client_key") or str(uuid.uuid4())

            if not csv_base64:
                raise ValueError("Missing portfolio data for rehydration")

            file_content = base64.b64decode(csv_base64).decode("utf-8")
            result = process_portfolio_upload(file_content, filename)

            portfolio_ref = {"portfolio_id": result["portfolio_id"], "schema": "v2"}
            filename_data = {"filename": filename, "total_trades": result["total_trades"]}
            success_msg = create_upload_success_message(
                filename, result["total_trades"], result["total_pl"]
            )

            saved_at = datetime.utcnow().isoformat() + "Z"
            upload_cache_payload = {
                "client_key": client_key,
                "filename": filename,
                "csv_base64": csv_base64,
                "portfolio_id": result["portfolio_id"],
                "summary": {
                    "total_trades": result["total_trades"],
                    "total_pl": result["total_pl"],
                    "upload_timestamp": result.get("upload_timestamp"),
                },
                "saved_at": saved_at,
            }

            meta_state = meta_state or {}
            meta_update = {
                **meta_state,
                "client_key": client_key,
                "rehydrated": True,
                "rehydrating": False,
                "last_portfolio_id": result["portfolio_id"],
                "last_saved_at": saved_at,
            }

            # Rehydrate daily log if available
            daily_log_section = rehydrate_payload.get("daily_log") or {}
            daily_outputs = (no_update, no_update, no_update, no_update, no_update)

            if daily_log_section.get("csv_base64"):
                dl_csv = base64.b64decode(daily_log_section["csv_base64"]).decode("utf-8")
                dl_filename = daily_log_section.get("filename", "daily-log.csv")
                dl_result = process_daily_log_upload(
                    dl_csv, dl_filename, portfolio_id=result["portfolio_id"]
                )

                daily_upload_msg = dmc.Alert(
                    children=[
                        dmc.Group(
                            children=[
                                DashIconify(icon="tabler:check", width=20, height=20),
                                dmc.Stack(
                                    children=[
                                        dmc.Text(f"Restored daily log: {dl_filename}", fw=500),
                                        dmc.Text(
                                            f"Loaded {dl_result['total_entries']} daily entries",
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

                daily_log_data = {"portfolio_id": result["portfolio_id"], "schema": "v2"}
                daily_filename_data = {
                    "filename": dl_filename,
                    "total_entries": dl_result["total_entries"],
                }
                daily_upload_cache = {
                    "client_key": client_key,
                    "filename": dl_filename,
                    "csv_base64": daily_log_section["csv_base64"],
                    "portfolio_id": result["portfolio_id"],
                    "summary": {
                        "total_entries": dl_result["total_entries"],
                        "date_range_start": dl_result["date_range_start"],
                        "date_range_end": dl_result["date_range_end"],
                    },
                    "saved_at": saved_at,
                }

                meta_update.update(
                    {
                        "has_daily_log": True,
                        "last_daily_log_saved_at": saved_at,
                    }
                )

                daily_outputs = (
                    daily_log_data,
                    daily_filename_data,
                    daily_upload_msg,
                    no_update,
                    daily_upload_cache,
                )

            return (
                portfolio_ref,
                filename_data,
                success_msg,
                upload_cache_payload,
                meta_update,
                None,
                *daily_outputs,
            )

        except Exception as exc:  # pragma: no cover - defensive logging
            logger.error(f"Error rehydrating portfolio from IndexedDB: {exc}")
            return (
                no_update,
                no_update,
                create_upload_error_message("Rehydration failed"),
                no_update,
                no_update,
                None,
                no_update,
                no_update,
                create_upload_error_message("Daily log rehydration failed"),
                no_update,
                no_update,
            )

    # Persist portfolio payloads to IndexedDB clientside
    app.clientside_callback(
        """
        async function(payload) {
            if (!payload || !payload.csv_base64) {
                return window.dash_clientside.no_update;
            }
            if (window.tradeblocksStorage && window.tradeblocksStorage.savePortfolio) {
                try {
                    await window.tradeblocksStorage.savePortfolio(payload);
                } catch (err) {
                    console.error('Failed to save portfolio to IndexedDB', err);
                }
            }
            return null;
        }
        """,
        Output("portfolio-upload-cache", "data", allow_duplicate=True),
        Input("portfolio-upload-cache", "data"),
        prevent_initial_call=True,
    )

    # Persist daily log payloads to IndexedDB clientside
    app.clientside_callback(
        """
        async function(payload) {
            if (!payload || !payload.csv_base64) {
                return window.dash_clientside.no_update;
            }
            if (window.tradeblocksStorage && window.tradeblocksStorage.saveDailyLog) {
                try {
                    await window.tradeblocksStorage.saveDailyLog(payload);
                } catch (err) {
                    console.error('Failed to save daily log to IndexedDB', err);
                }
            }
            return null;
        }
        """,
        Output("daily-log-upload-cache", "data", allow_duplicate=True),
        Input("daily-log-upload-cache", "data"),
        prevent_initial_call=True,
    )

    # Clear IndexedDB when user clears portfolio
    app.clientside_callback(
        """
        async function(action) {
            if (!action || action.action !== 'clear') {
                return window.dash_clientside.no_update;
            }
            if (window.tradeblocksStorage && window.tradeblocksStorage.clearAll) {
                try {
                    await window.tradeblocksStorage.clearAll();
                } catch (err) {
                    console.error('Failed to clear IndexedDB cache', err);
                }
            }
            return null;
        }
        """,
        Output("local-cache-actions", "data", allow_duplicate=True),
        Input("local-cache-actions", "data"),
        prevent_initial_call=True,
    )

    # Bootstrap rehydration on page load if server cache is empty
    app.clientside_callback(
        """
        async function(portfolioRef, meta) {
            const storage = window.tradeblocksStorage;
            const currentMeta = meta || {};
            if (!storage || !storage.getLatestPayload) {
                return [window.dash_clientside.no_update, currentMeta];
            }

            if (currentMeta.rehydrating) {
                return [window.dash_clientside.no_update, currentMeta];
            }

            const latest = await storage.getLatestPayload();
            if (!latest) {
                return [window.dash_clientside.no_update, currentMeta];
            }

            const serverId = portfolioRef && portfolioRef.portfolio_id;
            if (serverId) {
                try {
                    const res = await fetch(`/api/v1/portfolio/${serverId}/stats`, { credentials: 'same-origin' });
                    if (res && res.ok) {
                        return [window.dash_clientside.no_update, { ...currentMeta, client_key: latest.client_key, rehydrated: true }];
                    }
                } catch (err) {
                    console.debug('Portfolio stats fetch failed, attempting rehydrate', err);
                }
            }

            return [
                {
                    client_key: latest.client_key,
                    portfolio: latest.portfolio,
                    daily_log: latest.daily_log,
                },
                { ...currentMeta, client_key: latest.client_key, rehydrating: true },
            ];
        }
        """,
        [
            Output("portfolio-rehydrate-payload", "data", allow_duplicate=True),
            Output("portfolio-client-meta", "data", allow_duplicate=True),
        ],
        Input("current-portfolio-data", "data"),
        State("portfolio-client-meta", "data"),
        prevent_initial_call="initial_duplicate",
    )

    @app.callback(
        [
            Output("main-content", "children"),
            Output("nav-geekistics", "active"),
            Output("nav-performance", "active"),
            Output("nav-trade-data", "active"),
            Output("nav-monte-carlo", "active"),
            Output("nav-position-sizing", "active"),
            Output("nav-correlation", "active"),
            Output("nav-margin", "active"),
            Output("nav-optimizer", "active"),
        ],
        [
            Input("nav-geekistics", "n_clicks"),
            Input("nav-performance", "n_clicks"),
            Input("nav-trade-data", "n_clicks"),
            Input("nav-monte-carlo", "n_clicks"),
            Input("nav-position-sizing", "n_clicks"),
            Input("nav-correlation", "n_clicks"),
            Input("nav-margin", "n_clicks"),
            Input("nav-optimizer", "n_clicks"),
        ],
        [State("current-portfolio-data", "data")],
        prevent_initial_call=True,
    )
    def update_main_content_and_nav(
        geek_clicks,
        perf_clicks,
        trade_clicks,
        monte_clicks,
        position_clicks,
        corr_clicks,
        margin_clicks,
        opt_clicks,
        portfolio_data,
    ):
        """Update main content and navigation highlighting"""
        if not portfolio_data:
            return (
                create_welcome_content(),
                True,
                False,
                False,
                False,
                False,
                False,
                False,
                False,
            )

        triggered = ctx.triggered_id

        # Reset all nav states
        nav_states = [False] * 8

        if triggered == "nav-geekistics":
            nav_states[0] = True  # geekistics active
            return create_geekistics_tab(), *nav_states
        elif triggered == "nav-performance":
            nav_states[1] = True  # performance active
            # Build layout and log component IDs for debugging
            tab_layout = create_performance_charts_tab()

            def _collect_ids(node, acc):
                try:
                    # Record id if present
                    comp_id = getattr(node, "id", None)
                    if comp_id:
                        acc.add(comp_id)
                    # Recurse into children-like props
                    for prop in ("children",):
                        if hasattr(node, prop):
                            child = getattr(node, prop)
                            if isinstance(child, (list, tuple)):
                                for c in child:
                                    _collect_ids(c, acc)
                            else:
                                _collect_ids(child, acc)
                except Exception:
                    pass

            try:
                ids = set()
                _collect_ids(tab_layout, ids)
            except Exception as e:
                logger.warning(f"Could not collect performance tab IDs: {e}")

            return tab_layout, *nav_states
        elif triggered == "nav-trade-data":
            nav_states[2] = True  # trade-data active
            return create_trade_data_tab(), *nav_states
        elif triggered == "nav-monte-carlo":
            nav_states[3] = True  # monte-carlo active
            return create_risk_simulator_tab(), *nav_states  # New risk simulator tab
        elif triggered == "nav-position-sizing":
            nav_states[4] = True  # position-sizing active
            try:
                return create_position_sizing_tab(), *nav_states
            except Exception as exc:  # pragma: no cover - defensive UI guard
                logger.exception("Failed to render Position Sizing tab: %s", exc)
                fallback = dmc.Alert(
                    "Position Sizing tab failed to render. Check logs for details.",
                    color="red",
                    variant="light",
                )
                return fallback, *nav_states
        elif triggered == "nav-correlation":
            nav_states[5] = True  # correlation active
            return create_correlation_matrix_tab(), *nav_states
        elif triggered == "nav-margin":
            nav_states[6] = True  # margin active
            return create_capital_blocks_coming_soon(), *nav_states  # Coming soon page
        elif triggered == "nav-optimizer":
            nav_states[7] = True  # optimizer active
            return create_walk_forward_coming_soon(), *nav_states  # Coming soon page
        else:
            nav_states[0] = True  # Default to geekistics
            return create_geekistics_tab(), *nav_states

    @app.callback(
        [
            Output("geekistics-content", "children"),
            Output("geekistics-strategy-filter", "data"),
        ],
        [
            Input("current-portfolio-data", "data"),
            Input("current-daily-log-data", "data"),
            Input("geekistics-strategy-filter", "value"),
            Input("risk-free-rate-input", "value"),
        ],
        prevent_initial_call=False,
    )
    def update_geekistics_tab(portfolio_data, daily_log_data, selected_strategies, risk_free_rate):
        """Update the Geekistics tab with comprehensive statistics"""

        if not portfolio_data:
            return (
                dmc.Center(
                    dmc.Text("No portfolio data available", c="dimmed", size="lg"),
                    style={"height": "400px"},
                ),
                [],
            )

        try:
            portfolio_payload, portfolio_id = resolve_portfolio_payload(portfolio_data)
            if not portfolio_payload:
                logger.info("Portfolio payload missing for geekistics tab; prompting re-upload")
                return (
                    dmc.Center(
                        dmc.Stack(
                            [
                                dmc.Text(
                                    "We've changed how we cache your portfolio data in your browser.",
                                    c="orange",
                                    size="lg",
                                    fw=600,
                                ),
                                dmc.Text(
                                    "Please re-upload your trade log to continue.",
                                    c="dimmed",
                                ),
                            ],
                            gap="xs",
                            align="center",
                        ),
                        style={"height": "400px"},
                    ),
                    [],
                )

            daily_log_payload = resolve_daily_log_payload(daily_log_data, portfolio_id)

            all_trades_data = portfolio_payload.get("trades", []) or []

            all_strategies = list(set(trade.get("strategy", "") for trade in all_trades_data))
            strategy_options = [
                {"value": strategy, "label": strategy} for strategy in sorted(all_strategies)
            ]

            is_filtered = bool(selected_strategies)

            filtered_trades = all_trades_data
            if selected_strategies:
                filtered_trades = [
                    trade
                    for trade in all_trades_data
                    if trade.get("strategy") in selected_strategies
                ]

            filtered_portfolio_data = build_filtered_portfolio_payload(
                portfolio_payload, filtered_trades
            )

            portfolio_stats = calculate_portfolio_stats_dict(
                filtered_portfolio_data,
                daily_log_payload=daily_log_payload,
                is_filtered=is_filtered,
            )
            strategy_stats = calculate_strategy_stats_dict(filtered_portfolio_data)

            advanced_stats_request = {
                "portfolio_data": filtered_portfolio_data,
                "daily_log_data": daily_log_payload,
                "config": {"risk_free_rate": risk_free_rate or 2.0, "annualization_factor": 252},
                "is_filtered": is_filtered,
            }
            advanced_stats = calculate_advanced_stats_dict(advanced_stats_request)

            from app.dash_app.components.tabs.geekistics import create_comprehensive_stats

            content = create_comprehensive_stats(
                portfolio_stats,
                strategy_stats,
                filtered_trades,
                selected_strategies,
                advanced_stats,
            )
            return content, strategy_options

        except Exception as e:
            logger.error(f"Error updating geekistics tab: {str(e)}")
            return (
                dmc.Center(
                    dmc.Text(f"Error: {str(e)}", c="red", size="lg"), style={"height": "400px"}
                ),
                [],
            )

    # Removed old charts callback to avoid ID conflicts with Performance Blocks

    # Populate Performance Blocks strategy filter options
    @app.callback(
        Output("perf-strategy-filter", "data"),
        [Input("current-portfolio-data", "data")],
        prevent_initial_call=False,
    )
    def populate_perf_strategy_filter(portfolio_data):
        if not portfolio_data:
            return []
        try:
            payload, _ = resolve_portfolio_payload(portfolio_data)
            if not payload:
                logger.info("Portfolio payload missing for performance filter options")
                return []
            trades = payload.get("trades", [])
            strategies = sorted(
                list({t.get("strategy", "") for t in trades if isinstance(t, dict)})
            )
            return [{"value": s, "label": s} for s in strategies if s]
        except Exception as e:
            logger.warning(f"Could not build perf strategy options: {e}")
            return []

    # Performance Blocks: real-data callback

    @app.callback(
        [
            Output("perf-metrics-bar", "children"),
            Output("equity-curve-chart", "figure"),
            Output("drawdown-chart", "figure"),
            Output("day-of-week-chart", "figure"),
            Output("rom-distribution-chart", "figure"),
            Output("streak-distribution-chart", "figure"),
            Output("streak-statistics-group", "children"),
            Output("monthly-heatmap-chart", "figure"),
            Output("trade-sequence-chart", "figure"),
            Output("rom-timeline-chart", "figure"),
            Output("rolling-metrics-chart", "figure"),
            Output("risk-evolution-chart", "figure"),
            Output("performance-cache", "data"),
        ],
        [
            Input("current-portfolio-data", "data"),
            Input("perf-strategy-filter", "value"),
            Input("perf-date-range", "value"),
            Input("equity-scale-toggle", "value"),
            Input("equity-drawdown-areas", "checked"),
            Input("sequence-show-trend", "checked"),
            Input("rom-ma-period", "value"),
            Input("rolling-metric-type", "value"),
            Input("theme-store", "data"),
        ],
        [State("performance-cache", "data")],
        prevent_initial_call=False,
    )
    def update_performance_blocks(
        portfolio_data,
        strategy_filter,
        date_range,
        scale_mode,
        show_drawdown_areas,
        sequence_show_trend,
        rom_ma_period,
        rolling_metric_type,
        theme_data,
        performance_cache,
    ):
        """Update Performance Blocks charts from uploaded real data."""

        try:
            if not portfolio_data:
                mocks = get_mock_charts()
                empty_meta = {
                    "status": "empty",
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                }
                return (
                    get_mock_metrics(),
                    mocks["equity_curve"],
                    mocks["drawdown"],
                    mocks["day_of_week"],
                    mocks["rom_distribution"],
                    mocks["streak_distribution"],
                    generate_streak_statistics_group({}),
                    mocks["monthly_heatmap"],
                    mocks["trade_sequence"],
                    mocks["rom_timeline"],
                    mocks["rolling_metrics"],
                    mocks["risk_evolution"],
                    empty_meta,
                )

            payload, portfolio_id = resolve_portfolio_payload(portfolio_data)
            if not payload or not portfolio_id:
                logger.info("Portfolio payload missing; prompting re-upload for performance tab")
                notice = dmc.Stack(
                    [
                        dmc.Text(
                            "We've changed how we cache your portfolio data in your browser.",
                            c="orange",
                            fw=600,
                        ),
                        dmc.Text(
                            "Please re-upload your files to refresh the analytics.", c="dimmed"
                        ),
                    ],
                    gap="xs",
                )
                mocks = get_mock_charts()
                notice_meta = {
                    "status": "missing_portfolio",
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                }
                return (
                    notice,
                    mocks["equity_curve"],
                    mocks["drawdown"],
                    mocks["day_of_week"],
                    mocks["rom_distribution"],
                    mocks["streak_distribution"],
                    generate_streak_statistics_group({}),
                    mocks["monthly_heatmap"],
                    mocks["trade_sequence"],
                    mocks["rom_timeline"],
                    mocks["rolling_metrics"],
                    mocks["risk_evolution"],
                    notice_meta,
                )

            strategies = (
                list(strategy_filter)
                if isinstance(strategy_filter, (list, tuple))
                else ([strategy_filter] if strategy_filter else [])
            )

            try:
                dataset, filtered_trades, cache_key, hit = (
                    portfolio_cache.get_performance_blocks_dataset(
                        portfolio_id,
                        strategies=strategies,
                        date_range=date_range,
                        rom_ma_period=rom_ma_period,
                        rolling_metric_type=rolling_metric_type,
                    )
                )
            except KeyError:
                logger.info(
                    "Portfolio %s not cached for performance blocks; prompting re-upload",
                    portfolio_id,
                )
                mocks = get_mock_charts()
                missing_meta = {
                    "status": "uncached",
                    "portfolio_id": portfolio_id,
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                }
                return (
                    get_mock_metrics(),
                    mocks["equity_curve"],
                    mocks["drawdown"],
                    mocks["day_of_week"],
                    mocks["rom_distribution"],
                    mocks["streak_distribution"],
                    generate_streak_statistics_group({}),
                    mocks["monthly_heatmap"],
                    mocks["trade_sequence"],
                    mocks["rom_timeline"],
                    mocks["rolling_metrics"],
                    mocks["risk_evolution"],
                    missing_meta,
                )

            if not filtered_trades:
                mocks = get_mock_charts()
                filtered_meta = {
                    "status": "no_trades",
                    "portfolio_id": portfolio_id,
                    "strategies": strategies,
                    "date_range": date_range or "all",
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                }
                return (
                    get_mock_metrics(),
                    mocks["equity_curve"],
                    mocks["drawdown"],
                    mocks["day_of_week"],
                    mocks["rom_distribution"],
                    mocks["streak_distribution"],
                    generate_streak_statistics_group({}),
                    mocks["monthly_heatmap"],
                    mocks["trade_sequence"],
                    mocks["rom_timeline"],
                    mocks["rolling_metrics"],
                    mocks["risk_evolution"],
                    filtered_meta,
                )

            equity_data = dataset.get("equity_data", {})
            distribution_data = dataset.get("distribution_data", {})
            streak_data = dataset.get("streak_data", {})
            monthly_data = dataset.get("monthly_data", {})
            sequence_data = dataset.get("sequence_data", {})
            rom_data = dataset.get("rom_data", {})
            rolling_data = dataset.get("rolling_data", {})

            equity_fig = create_equity_curve_chart(
                equity_data,
                scale=scale_mode or "linear",
                show_drawdown_areas=bool(show_drawdown_areas),
                theme_data=theme_data,
            )
            drawdown_fig = create_drawdown_chart(equity_data, theme_data=theme_data)
            dow_fig = create_day_of_week_distribution_chart(
                distribution_data, theme_data=theme_data
            )
            rom_dist_fig = create_rom_distribution_chart(distribution_data, theme_data=theme_data)
            streak_fig = create_streak_distribution_chart(streak_data, theme_data=theme_data)
            heatmap_fig = create_monthly_heatmap_chart(monthly_data, theme_data=theme_data)
            sequence_fig = create_trade_sequence_chart(
                sequence_data, bool(sequence_show_trend), theme_data=theme_data
            )
            rom_timeline_fig = create_rom_timeline_chart(
                rom_data, rom_ma_period or "30", theme_data=theme_data
            )
            rolling_fig = create_rolling_metrics_chart(
                rolling_data, rolling_metric_type or "win_rate", theme_data=theme_data
            )
            risk_fig = create_risk_evolution_chart(rolling_data, theme_data=theme_data)

            streak_stats = generate_streak_statistics_group(streak_data)

            try:
                metrics = generate_real_metrics(
                    equity_data, distribution_data, streak_data, filtered_trades, monthly_data
                )
            except Exception:
                metrics = get_mock_metrics()

            cache_meta = {
                "status": "ok",
                "portfolio_id": portfolio_id,
                "cache_key": cache_key,
                "from_cache": hit,
                "strategies": strategies,
                "date_range": date_range or "all",
                "rom_ma_period": rom_ma_period or "30",
                "rolling_metric_type": rolling_metric_type or "win_rate",
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }

            return (
                metrics,
                equity_fig,
                drawdown_fig,
                dow_fig,
                rom_dist_fig,
                streak_fig,
                streak_stats,
                heatmap_fig,
                sequence_fig,
                rom_timeline_fig,
                rolling_fig,
                risk_fig,
                cache_meta,
            )
        except Exception as e:
            logger.error(f"Error updating Performance Blocks: {e}")
            mocks = get_mock_charts()
            error_meta = {
                "status": "error",
                "message": str(e),
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }
            return (
                get_mock_metrics(),
                mocks.get("equity_curve", {}),
                mocks.get("drawdown", {}),
                mocks.get("day_of_week", {}),
                mocks.get("rom_distribution", {}),
                mocks.get("streak_distribution", {}),
                generate_streak_statistics_group({}),
                mocks.get("monthly_heatmap", {}),
                mocks.get("trade_sequence", {}),
                mocks.get("rom_timeline", {}),
                mocks.get("rolling_metrics", {}),
                mocks.get("risk_evolution", {}),
                error_meta,
            )

    @app.callback(
        [
            Output("trades-table-container", "children"),
            Output("trade-summary-stats", "children"),
            Output("trade-strategy-filter", "data"),
        ],
        [
            Input("current-portfolio-data", "data"),
            Input("trade-strategy-filter", "value"),
            Input("nav-trade-data", "n_clicks"),
        ],
        prevent_initial_call=False,
    )
    def update_trade_data_tab(portfolio_data, strategy_filter, nav_clicks):
        """Update the Trade Data tab"""
        if not portfolio_data:
            return "", [], []

        try:
            payload, _ = resolve_portfolio_payload(portfolio_data)
            if not payload:
                logger.info("Portfolio payload missing for trade data tab; prompting re-upload")
                message = dmc.Text(
                    "Please re-upload your trade log to view trade history.",
                    c="dimmed",
                )
                return message, [], []

            all_trades = payload.get("trades", [])

            if strategy_filter:
                trades_data = [
                    trade for trade in all_trades if trade.get("strategy") == strategy_filter
                ]
            else:
                trades_data = all_trades

            strategy_options = [
                {"value": strategy, "label": strategy}
                for strategy in sorted({trade.get("strategy", "") for trade in all_trades})
                if strategy
            ]

            trades_table = create_trades_table(trades_data)
            summary_stats = create_trade_summary_stats(trades_data)

            return trades_table, summary_stats, strategy_options

        except Exception as e:
            logger.error(f"Error updating trade data tab: {str(e)}")
            return f"Error: {str(e)}", [], []

    @app.callback(
        Output("main-content", "children", allow_duplicate=True),
        [Input("current-portfolio-data", "data")],
        prevent_initial_call=True,
    )
    def update_content_on_upload(portfolio_data):
        """Update main content when portfolio is uploaded"""
        if portfolio_data:
            return create_geekistics_tab()
        else:
            return create_welcome_content()

    # Use clientside callback to avoid server-side modal issues
    app.clientside_callback(
        """
        function(clear_clicks, cancel_clicks, confirm_clicks, modal_opened) {
            const triggered = window.dash_clientside.callback_context.triggered;
            if (!triggered || triggered.length === 0) {
                return false;
            }

            const triggeredId = triggered[0].prop_id.split('.')[0];

            if (triggeredId === 'clear-portfolio-button' && clear_clicks) {
                return true;
            } else if ((triggeredId === 'clear-cancel-button' || triggeredId === 'clear-confirm-button') && (cancel_clicks || confirm_clicks)) {
                return false;
            }

            return false;
        }
        """,
        Output("clear-confirm-modal", "opened"),
        [
            Input("clear-portfolio-button", "n_clicks"),
            Input("clear-cancel-button", "n_clicks"),
            Input("clear-confirm-button", "n_clicks"),
        ],
        [State("clear-confirm-modal", "opened")],
        prevent_initial_call=True,
    )

    @app.callback(
        [
            Output("current-portfolio-data", "data", allow_duplicate=True),
            Output("portfolio-filename", "data", allow_duplicate=True),
            Output("current-daily-log-data", "data", allow_duplicate=True),
            Output("daily-log-filename", "data", allow_duplicate=True),
            Output("portfolio-upload-cache", "data", allow_duplicate=True),
            Output("daily-log-upload-cache", "data", allow_duplicate=True),
            Output("portfolio-client-meta", "data", allow_duplicate=True),
            Output("local-cache-actions", "data", allow_duplicate=True),
        ],
        [Input("clear-confirm-button", "n_clicks")],
        prevent_initial_call=True,
    )
    def clear_portfolio(n_clicks):
        """Clear portfolio and daily log data from localStorage"""
        if n_clicks:
            return (
                None,
                None,
                None,
                None,
                None,
                None,
                {},
                {"action": "clear"},
            )
        return (
            no_update,
            no_update,
            no_update,
            no_update,
            no_update,
            no_update,
            no_update,
            no_update,
        )

    # Disclaimer modal callback
    @app.callback(
        Output("disclaimer-modal", "opened"),
        [Input("disclaimer-link", "n_clicks")],
        [State("disclaimer-modal", "opened")],
        prevent_initial_call=True,
    )
    def toggle_disclaimer_modal(disclaimer_clicks, modal_opened):
        """Toggle the disclaimer modal when the footer link is clicked"""
        if disclaimer_clicks and disclaimer_clicks > 0:
            return not modal_opened if modal_opened is not None else True
        return no_update
