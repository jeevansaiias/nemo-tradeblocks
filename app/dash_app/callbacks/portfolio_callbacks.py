from dash import Input, Output, State, callback, html, ctx, no_update
import dash_mantine_components as dmc
from dash_iconify import DashIconify
import base64
import logging
from app.data.models import Trade
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

from app.services.portfolio_service import (
    calculate_advanced_stats_dict,
    calculate_portfolio_stats_dict,
    calculate_strategy_stats_dict,
    calculate_trades_dict,
    process_daily_log_upload,
    process_portfolio_upload,
)

logger = logging.getLogger(__name__)


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
        ],
        [Input("portfolio-upload", "contents")],
        [State("portfolio-upload", "filename")],
        prevent_initial_call=True,
    )
    def upload_portfolio(contents, filename):
        """Handle trade log file upload"""
        if contents is None:
            return no_update, no_update, ""

        try:
            # Decode the file contents
            content_type, content_string = contents.split(",")
            decoded = base64.b64decode(content_string)
            file_content = decoded.decode("utf-8")

            result = process_portfolio_upload(file_content, filename)
            portfolio_data = result["portfolio_data"]

            success_msg = create_upload_success_message(
                filename, result["total_trades"], result["total_pl"]
            )

            filename_data = {"filename": filename, "total_trades": result["total_trades"]}

            return portfolio_data, filename_data, success_msg

        except Exception as e:
            logger.error(f"Error uploading trade log file: {str(e)}")
            return no_update, no_update, create_upload_error_message(str(e))

    @app.callback(
        [
            Output("current-daily-log-data", "data"),
            Output("daily-log-filename", "data"),
            Output("daily-upload-feedback", "children"),
            Output("daily-log-upload", "children"),
        ],
        [Input("daily-log-upload", "contents")],
        [State("daily-log-upload", "filename")],
        prevent_initial_call=True,
    )
    def upload_daily_log(contents, filename):
        """Handle daily log file upload"""
        if contents is None:
            return no_update, no_update, "", no_update

        try:
            # Decode the file contents
            content_type, content_string = contents.split(",")
            decoded = base64.b64decode(content_string)
            file_content = decoded.decode("utf-8")

            result = process_daily_log_upload(file_content, filename)

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

            daily_log_data = result["daily_log_data"]
            filename_data = {"filename": filename, "total_entries": result["total_entries"]}

            return daily_log_data, filename_data, success_msg, no_update

        except Exception as e:
            logger.error(f"Error uploading daily log file: {str(e)}")
            return no_update, no_update, create_upload_error_message(str(e)), no_update

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
            Output("position-sizing-present", "data"),
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
                False,
            )

        triggered = ctx.triggered_id

        # Reset all nav states
        nav_states = [False] * 8

        if triggered == "nav-geekistics":
            nav_states[0] = True  # geekistics active
            return create_geekistics_tab(), *nav_states, False
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

            return tab_layout, *nav_states, False
        elif triggered == "nav-trade-data":
            nav_states[2] = True  # trade-data active
            return create_trade_data_tab(), *nav_states, False
        elif triggered == "nav-monte-carlo":
            nav_states[3] = True  # monte-carlo active
            return create_risk_simulator_tab(), *nav_states, False  # New risk simulator tab
        elif triggered == "nav-position-sizing":
            nav_states[4] = True  # position-sizing active
            try:
                return create_position_sizing_tab(), *nav_states, True
            except Exception as exc:  # pragma: no cover - defensive UI guard
                logger.exception("Failed to render Position Sizing tab: %s", exc)
                fallback = dmc.Alert(
                    "Position Sizing tab failed to render. Check logs for details.",
                    color="red",
                    variant="light",
                )
                return fallback, *nav_states, True
        elif triggered == "nav-correlation":
            nav_states[5] = True  # correlation active
            return create_correlation_matrix_tab(), *nav_states, False
        elif triggered == "nav-margin":
            nav_states[6] = True  # margin active
            return create_capital_blocks_coming_soon(), *nav_states, False  # Coming soon page
        elif triggered == "nav-optimizer":
            nav_states[7] = True  # optimizer active
            return create_walk_forward_coming_soon(), *nav_states, False  # Coming soon page
        else:
            nav_states[0] = True  # Default to geekistics
            return create_geekistics_tab(), *nav_states, False

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
            trades_response = calculate_trades_dict(portfolio_data)
            all_trades_data = trades_response.get("trades", [])

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

            filtered_portfolio_data = portfolio_data.copy()
            filtered_portfolio_data["trades"] = filtered_trades

            portfolio_stats = calculate_portfolio_stats_dict(
                filtered_portfolio_data,
                daily_log_payload=daily_log_data,
                is_filtered=is_filtered,
            )
            strategy_stats = calculate_strategy_stats_dict(filtered_portfolio_data)

            advanced_stats_request = {
                "portfolio_data": filtered_portfolio_data,
                "daily_log_data": daily_log_data,
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
            trades = portfolio_data.get("trades", []) if isinstance(portfolio_data, dict) else []
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
    ):
        """Update Performance Blocks charts from uploaded real data."""
        try:
            if not portfolio_data:
                # Nothing loaded yet; show mocks unobtrusively
                mocks = get_mock_charts()
                return (
                    get_mock_metrics(),
                    mocks["equity_curve"],
                    mocks["drawdown"],
                    mocks["day_of_week"],
                    mocks["rom_distribution"],
                    mocks["streak_distribution"],
                    mocks["monthly_heatmap"],
                    mocks["trade_sequence"],
                    mocks["rom_timeline"],
                    mocks["rolling_metrics"],
                    mocks["risk_evolution"],
                )

            # Convert dicts to Trade objects
            all_trades_data = (
                portfolio_data.get("trades", []) if isinstance(portfolio_data, dict) else []
            )
            trades = []
            for t in all_trades_data:
                try:
                    # Trade model import placed at top; create instances
                    trades.append(Trade(**t) if not isinstance(t, Trade) else t)
                except Exception:
                    # Skip malformed rows gracefully
                    continue

            if not trades:
                mocks = get_mock_charts()
                return (
                    get_mock_metrics(),
                    mocks["equity_curve"],
                    mocks["drawdown"],
                    mocks["day_of_week"],
                    mocks["rom_distribution"],
                    mocks["streak_distribution"],
                    mocks["monthly_heatmap"],
                    mocks["trade_sequence"],
                    mocks["rom_timeline"],
                    mocks["rolling_metrics"],
                    mocks["risk_evolution"],
                )

            # Apply strategy filter
            if strategy_filter:
                selected = (
                    set(strategy_filter) if isinstance(strategy_filter, list) else {strategy_filter}
                )
                trades = [tr for tr in trades if tr.strategy in selected]

            # Apply date range filter
            if date_range and date_range != "all":
                from datetime import date, timedelta

                today = max((tr.date_opened for tr in trades), default=None) or date.today()
                start = None
                if date_range == "ytd":
                    start = date(today.year, 1, 1)
                elif date_range == "1y":
                    start = today - timedelta(days=365)
                elif date_range == "6m":
                    start = today - timedelta(days=182)
                elif date_range == "3m":
                    start = today - timedelta(days=91)
                elif date_range == "1m":
                    start = today - timedelta(days=30)

                if start:
                    trades = [tr for tr in trades if tr.date_opened >= start]

            # Compute datasets
            from app.calculations.performance import PerformanceCalculator

            calc = PerformanceCalculator()
            equity_data = calc.calculate_enhanced_cumulative_equity(trades)
            distribution_data = calc.calculate_trade_distributions(trades)
            streak_data = calc.calculate_streak_distributions(trades)
            monthly_data = calc.calculate_monthly_heatmap_data(trades)
            sequence_data = calc.calculate_trade_sequence_data(trades)
            rom_data = calc.calculate_rom_over_time(trades)
            rolling_data = calc.calculate_rolling_metrics(trades)

            # Build figures
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

            # Generate streak statistics
            streak_stats = generate_streak_statistics_group(streak_data)

            # Metrics bar - generate from already calculated data
            try:
                from app.dash_app.components.tabs.performance_charts import generate_real_metrics

                metrics = generate_real_metrics(
                    equity_data, distribution_data, streak_data, trades, monthly_data
                )
            except Exception:
                metrics = get_mock_metrics()

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
            )
        except Exception as e:
            logger.error(f"Error updating Performance Blocks: {e}")
            # Fail-safe: return mocks to keep UI responsive
            mocks = get_mock_charts()
            return (
                get_mock_metrics(),
                mocks.get("equity_curve", {}),
                mocks.get("drawdown", {}),
                mocks.get("day_of_week", {}),
                mocks.get("rom_distribution", {}),
                mocks.get("streak_distribution", {}),
                generate_streak_statistics_group({}),  # Default streak stats
                mocks.get("monthly_heatmap", {}),
                mocks.get("trade_sequence", {}),
                mocks.get("rom_timeline", {}),
                mocks.get("rolling_metrics", {}),
                mocks.get("risk_evolution", {}),
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
            request_data = portfolio_data.copy()
            trades_response = calculate_trades_dict(request_data)
            all_trades = trades_response.get("trades", [])

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
        ],
        [Input("clear-confirm-button", "n_clicks")],
        prevent_initial_call=True,
    )
    def clear_portfolio(n_clicks):
        """Clear portfolio and daily log data from localStorage"""
        if n_clicks:
            return None, None, None, None
        return no_update, no_update, no_update, no_update

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
