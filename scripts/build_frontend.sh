#!/bin/bash

# Build script for vxi_dash frontend
# Builds the React app and copies it to backend/static for production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "========================================="
echo "  VXI Dashboard - Frontend Build Script"
echo "========================================="
echo ""

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_STATIC_DIR="$PROJECT_ROOT/backend/static"

print_status "Project root: $PROJECT_ROOT"
print_status "Frontend directory: $FRONTEND_DIR"
print_status "Target directory: $BACKEND_STATIC_DIR"
echo ""

# Check prerequisites
print_status "Checking prerequisites..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi

NODE_VERSION=$(node --version)
print_success "Node.js $NODE_VERSION found"
echo ""

# Install frontend dependencies
print_status "Installing frontend dependencies..."
cd "$FRONTEND_DIR"
npm install

if [ $? -ne 0 ]; then
    print_error "Failed to install dependencies"
    exit 1
fi
print_success "Dependencies installed"
echo ""

# Build frontend
print_status "Building frontend for production..."
npm run build

if [ $? -ne 0 ]; then
    print_error "Frontend build failed"
    exit 1
fi
print_success "Frontend build completed"
echo ""

# Copy to backend/static
print_status "Copying build artifacts to backend/static..."

# Remove old static files if they exist
if [ -d "$BACKEND_STATIC_DIR" ]; then
    print_status "Removing old static files..."
    rm -rf "$BACKEND_STATIC_DIR"
fi

# Copy new build
cp -r "$FRONTEND_DIR/dist" "$BACKEND_STATIC_DIR"

if [ $? -ne 0 ]; then
    print_error "Failed to copy build artifacts"
    exit 1
fi
print_success "Build artifacts copied successfully"
echo ""

# Summary
echo "========================================="
print_success "Build completed successfully!"
echo "========================================="
echo ""
echo "Static files are now in: $BACKEND_STATIC_DIR"
echo ""
echo "To run the production server:"
echo "  cd backend"
echo "  poetry run uvicorn app.main:app --host 0.0.0.0 --port 8000"
echo ""
echo "Then open: http://localhost:8000"
echo ""
