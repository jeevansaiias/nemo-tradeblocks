import os
import sys
from fastapi import FastAPI
from fastapi.middleware.wsgi import WSGIMiddleware

from app.dash_app.app import create_dash_app
from app.api.portfolio import router as portfolio_router

# Create FastAPI application
fastapi_app = FastAPI(
    title="TradeBlocks - Trading Analytics API",
    description="🧱 Build smarter trades with powerful analytics, one block at a time! 📊",
    version="1.0.0"
)

# Mount API routes
fastapi_app.include_router(portfolio_router, prefix="/api/v1")

# Create Dash app
dash_app = create_dash_app()

# Mount Dash app under FastAPI using WSGI middleware
fastapi_app.mount("/", WSGIMiddleware(dash_app.server))

# Export the FastAPI app for uvicorn
app = fastapi_app

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))

    # Check if running in debug mode (VS Code/debugpy)
    is_debug_mode = (
        os.getenv("DEBUG") or
        any("debugpy" in arg for arg in sys.argv) or
        any("--debug" in arg for arg in sys.argv)
    )

    if is_debug_mode:
        print("🧱 Running TradeBlocks in debug mode with hot-reload enabled")
        print(f"🚀 Access app at: http://localhost:{port}")
        print(f"📡 API docs at: http://localhost:{port}/docs")
        print("🔄 Hot-reload is active - changes will auto-refresh")

        # Run with uvicorn for proper FastAPI + Dash integration
        uvicorn.run(
            "app.main:app",
            host="0.0.0.0",
            port=port,
            reload=True,
            reload_dirs=["app"],
            log_level="info"
        )
    else:
        # Production mode
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=port,
            log_level="info"
        )
