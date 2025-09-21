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

# Check if Python 3.11+ is installed
print_status "Checking Python version..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
    print_status "Found Python $PYTHON_VERSION"

    # Check if version is 3.11 or higher
    if python3 -c 'import sys; exit(0 if sys.version_info >= (3, 11) else 1)'; then
        print_success "Python version is compatible"
    else
        print_error "Python 3.11+ is required. Please upgrade Python."
        exit 1
    fi
else
    print_error "Python 3 is not installed. Please install Python 3.11+."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    print_status "Creating virtual environment..."
    python3 -m venv venv
    print_success "Virtual environment created"
else
    print_status "Virtual environment already exists"
fi

# Activate virtual environment
print_status "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
print_status "Upgrading pip..."
pip install --upgrade pip

# Install production dependencies
print_status "Installing production dependencies..."
pip install -r requirements.txt

# Install development dependencies if they exist
if [ -f "dev-requirements.txt" ]; then
    print_status "Installing development dependencies..."
    pip install -r dev-requirements.txt
else
    print_status "Installing basic development tools..."
    pip install pytest pytest-cov black ruff mypy pre-commit ipython rich watchdog httpx
fi

# Setup pre-commit hooks if .pre-commit-config.yaml exists
if [ -f ".pre-commit-config.yaml" ]; then
    print_status "Installing pre-commit hooks..."
    pre-commit install
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
echo "  1. Activate virtual environment: source venv/bin/activate"
echo "  2. Start development server: ./scripts/start-dev.sh"
echo "  3. Open browser: http://localhost:8000"
echo ""
echo "Available scripts:"
echo "  ./scripts/start-dev.sh  - Start development server"
echo "  ./scripts/seed-data.sh  - Load sample data"
echo "  pytest                  - Run tests"
echo "  black app tests         - Format code"
echo "  ruff check app tests    - Check code quality"
echo ""
echo "Happy coding! 🚀"
