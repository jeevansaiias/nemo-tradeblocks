#!/bin/bash

# Portfolio Analyzer - One-Command Setup Script
# This script sets up the development environment

set -e  # Exit on any error

echo "🚀 Setting up Portfolio Analyzer development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Ensure uv is installed
print_status "Checking for uv..."
if ! command -v uv &> /dev/null; then
    print_error "uv is not installed. See https://docs.astral.sh/uv/getting-started/#installation"
    exit 1
fi
print_success "uv detected"

# Ensure requested Python is available via uv
if [ -f .python-version ]; then
    PYTHON_VERSION=$(cat .python-version)
    print_status "Ensuring Python ${PYTHON_VERSION} is installed..."
    uv python install "${PYTHON_VERSION}" >/dev/null 2>&1 || true
    print_success "Python ${PYTHON_VERSION} available"
else
    print_warning ".python-version not found; uv will choose a compatible interpreter"
fi

# Install project dependencies using uv (including dev group)
print_status "Syncing project dependencies via uv..."
uv sync --group dev
print_success "Dependencies installed"

# Setup pre-commit hooks if .pre-commit-config.yaml exists
if [ -f ".pre-commit-config.yaml" ]; then
    print_status "Installing pre-commit hooks..."
    uv run --group dev pre-commit install
    print_success "Pre-commit hooks installed"
else
    print_warning "No pre-commit configuration found, skipping pre-commit setup"
fi

# Create .env file from template if it doesn't exist
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
    print_status "Creating .env file from template..."
    cp .env.example .env
    print_success ".env file created"
    print_warning "Please review and update .env file with your settings"
else
    print_status ".env file already exists or no template found"
fi

# Check if Docker is installed
if command -v docker &> /dev/null; then
    print_success "Docker is installed"
    if command -v docker-compose &> /dev/null; then
        print_success "Docker Compose is installed"
    else
        print_warning "Docker Compose not found. Install it for container development."
    fi
else
    print_warning "Docker not found. Install Docker for container development."
fi

# Setup complete, ready to develop!

print_success "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Sync optional analytics stack (if needed): uv sync --group dev --extra analytics"
echo "  2. Start development server: ./scripts/start-dev.sh"
echo "  3. Open browser: http://localhost:8000"
echo ""
echo "Available scripts:"
echo "  ./scripts/start-dev.sh  - Start development server"
echo "  ./scripts/check-code.sh - Run quick quality checks"
echo "  ./scripts/fix-code.sh   - Apply formatting fixes"
echo "  uv run --group dev pytest - Run tests"
echo ""
echo "Happy coding! 🚀"
