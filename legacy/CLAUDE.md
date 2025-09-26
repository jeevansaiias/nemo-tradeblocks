# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Development Commands

### Running the Application
```bash
# Start development server (with hot-reload)
PORT=8001 PYTHONPATH=/Users/davidromero/Code/tradeblocks python app/main.py

# Alternative with default port (8000)
PYTHONPATH=/Users/davidromeo/Code/tradeblocks python app/main.py
```

### Testing
```bash
# Run all tests
PYTHONPATH=/Users/davidromero/Code/tradeblocks pytest tests/ -v

# Run specific test modules
PYTHONPATH=/Users/davidromero/Code/tradeblocks pytest tests/unit/test_processor.py -v
PYTHONPATH=/Users/davidromero/Code/tradeblocks pytest tests/integration/test_api.py -v

# Run with coverage and shorter traceback
PYTHONPATH=/Users/davidromero/Code/tradeblocks pytest tests/ -v --tb=short

# Run single test function
PYTHONPATH=/Users/davidromero/Code/tradeblocks pytest tests/unit/test_processor.py::test_portfolio_stats_calculation -v
```

### Code Quality & Formatting
```bash
# Run pre-commit hooks manually
pre-commit run --all-files

# Format code with Black (100 char line length)
black app/ tests/

# Lint with Ruff
ruff check app/ tests/
```

## Architecture Overview

### Application Stack
- **Backend**: FastAPI + Uvicorn (async Python web framework)
- **Frontend**: Dash + Dash Mantine Components (React-based Python UI)
- **Charts**: Plotly (interactive data visualizations)
- **Data Processing**: Pandas + NumPy + SciPy
- **Deployment**: Vercel (serverless Python functions)

### Key Architectural Patterns

#### Hybrid FastAPI + Dash Integration
The application uniquely combines REST API with interactive dashboard:
- **FastAPI** serves stateless API endpoints at `/api/v1/*`
- **Dash** provides the interactive UI mounted at root `/`
- **WSGIMiddleware** bridges the two frameworks in `app/main.py`
- Both frameworks share the same process and can access common modules

#### Separation of Concerns by Layer
```
app/
├── main.py              # FastAPI + Dash integration point
├── api/                 # REST API endpoints (stateless)
├── data/                # Data models and CSV processing
├── calculations/        # Pure calculation functions (no state)
├── dash_app/           # UI layer (components, callbacks, layouts)
└── utils/              # Shared utilities
```

#### Stateless Calculation Design
All calculations are pure functions that:
- Take portfolio data as input parameters
- Return structured results (no side effects)
- Can be called from either API endpoints or Dash callbacks
- Are located in `calculations/` modules organized by domain

#### Dash Component Architecture
```
dash_app/
├── app.py              # Dash app factory function
├── layouts/            # Page structure and routing
├── components/tabs/    # Main application tabs
├── callbacks/          # Interactive behavior and data flow
```

### Critical Integration Points

#### Data Flow Pattern
1. **CSV Upload** → `api/portfolio.py` → `data/processor.py` → Structured models
2. **Calculations** → `calculations/*` modules → Pure functions return results
3. **API Responses** → Stateless endpoints serve JSON to any consumer
4. **UI Updates** → Dash callbacks call calculations → Update components

#### Portfolio Processing Pipeline
- Upload: CSV → `PortfolioProcessor` → `Trade`/`Portfolio` models
- Storage: Dash clientside storage (`dcc.Store` components)
- Analysis: User interactions → Callbacks → Calculation modules → UI updates

#### Component Organization Pattern
Each major application tab follows this structure:
- UI component: `components/tabs/{tab_name}.py`
- Behavior: `callbacks/{tab_name}_callbacks.py`
- Mock data: Functions for development/testing
- Real integration: API calls to calculation endpoints

### Environment Configuration
- **Development**: `PYTHONPATH` must point to project root for imports
- **Production**: Vercel deployment via `vercel.json` configuration
- **Dependencies**: Poetry (`pyproject.toml`) with dev/prod separation
- **Environment Variables**: `.env` file (gitignored) for sensitive config

---

# TradeBlocks Project Guide

## Git Commit Policies & Best Practices

### Pre-commit Hooks Configuration
The project uses pre-commit hooks to maintain code quality:

**File**: `.pre-commit-config.yaml`
- **Trailing whitespace removal** - Cleans up file endings
- **End-of-file fixer** - Ensures proper file termination
- **Merge conflict checker** - Prevents accidental conflict markers
- **Large file checker** - Blocks files >1MB from commits
- **Black code formatter** - Auto-formats Python code

### Git Workflow Rules

#### Branch Strategy
- **Feature branches**: `feature/descriptive-name` (e.g., `feature/performanceGraphs`)
- Always work on feature branches, never commit directly to main
- Use pull requests for code review and merging

#### Commit Message Standards
Based on recent commits, follow this pattern:
```
[Action] [Component/Area]: [Description]

Examples:
- "Refactor performance charts to use mock data and enhance layout for Performance Blocks page"
- "Add comprehensive implementation plan for Performance Blocks page with detailed calculations"
- "Refactor API base URL retrieval to simplify logic and enhance production compatibility"
```

**Action Verbs to Use:**
- `Add` - New features/files
- `Refactor` - Code restructuring
- `Update` - Modifications to existing features
- `Fix` - Bug fixes
- `Remove` - Deletions
- `Merge` - Pull request merges

#### What NOT to Commit
Per `.gitignore`:
- `__pycache__/` and `*.pyc` files
- Virtual environments (`venv/`, `env/`)
- Environment files (`.env`, `.env.local`)
- IDE files (`.vscode/`, `.idea/`)
- OS files (`.DS_Store`)
- Logs (`*.log`, `logs/`)
- Cache directories (`.cache/`, `.pytest_cache/`)
- Sample data (`/sampleData`)
- MyPy cache (`/.mypy_cache`)
- Claude context (`/.claude`)

#### Code Quality Requirements
1. **Pre-commit hooks must pass** - No bypassing with `--no-verify`
2. **Black formatting applied** - Code automatically formatted
3. **No trailing whitespace** - Cleaned automatically
4. **No large files** - Keep commits lean
5. **No merge conflicts** - Resolve before committing

#### Development Workflow
1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes and test locally
3. Run pre-commit: `pre-commit run --all-files` (optional, runs automatically)
4. Commit with descriptive message
5. Push to origin: `git push origin feature/your-feature`
6. Create pull request for review
7. Merge after approval

### Environment & Deployment Notes
- Uses Vercel for deployment (`vercel.json` configuration)
- Environment variables managed via `.env` (not committed)
- API base URL dynamically set for production/local environments
- Python path set via `PYTHONPATH=/Users/davidromeo/Code/tradeblocks`

### Testing & Validation
- Tests can be run via pytest: `PYTHONPATH=/Users/davidromeo/Code/tradeblocks pytest tests/ -v`
- Core logic validation recommended before UI changes
- No need to run application for UI validation - user provides feedback

### File Organization
```
app/
├── calculations/       # Core calculation logic
├── dash_app/          # UI components and layouts
│   ├── components/    # Reusable UI components
│   ├── callbacks/     # Dash callback functions
│   └── layouts/       # Page layouts
├── data/              # Data processing and models
└── api/               # API endpoints
```

### Development Principles
- **Never create files unless absolutely necessary**
- **Always prefer editing existing files over creating new ones**
- **Never proactively create documentation files** unless explicitly requested
- **Follow existing code conventions** and patterns
- **Use existing libraries and utilities** - check imports before adding new dependencies
