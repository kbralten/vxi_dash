#!/bin/bash

# VXI Dashboard - Service Runner Script
# This script runs both backend (FastAPI) and frontend (React/Vite) services

set -e  # Exit on any error

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

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if poetry is available (globally or in venv)
poetry_available() {
    if command_exists poetry; then
        return 0
    elif [[ -f "./venv/bin/poetry" ]]; then
        return 0
    else
        return 1
    fi
}

# Function to run poetry command (handles local venv poetry)
run_poetry() {
    if command_exists poetry; then
        poetry "$@"
    elif [[ -f "./venv/bin/poetry" ]]; then
        source ./venv/bin/activate
        poetry "$@"
    else
        print_error "Poetry not found"
        return 1
    fi
}

# Function to cleanup background processes on exit
cleanup() {
    print_status "Cleaning up background processes..."
    if [[ -n $BACKEND_PID ]]; then
        kill $BACKEND_PID 2>/dev/null || true
        print_status "Backend process stopped"
    fi
    if [[ -n $FRONTEND_PID ]]; then
        kill $FRONTEND_PID 2>/dev/null || true
        print_status "Frontend process stopped"
    fi
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Check for required tools
print_status "Checking required tools..."

if ! command_exists python3; then
    print_error "Python 3 is required but not installed"
    exit 1
fi

if ! poetry_available; then
    print_error "Poetry is required but not found"
    print_status "Poetry should be available either globally or in ./venv/bin/poetry"
    print_status "To install Poetry globally: curl -sSL https://install.python-poetry.org | python3 -"
    print_status "Or activate your virtual environment if Poetry is installed there"
    exit 1
fi

if ! command_exists node; then
    print_error "Node.js is required but not installed"
    exit 1
fi

if ! command_exists npm; then
    print_error "npm is required but not installed"
    exit 1
fi

print_success "All required tools are available"

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Parse command line arguments
MODE="dev"
BACKEND_ONLY=false
FRONTEND_ONLY=false
BACKGROUND=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --prod|--production)
            MODE="prod"
            shift
            ;;
        --backend-only)
            BACKEND_ONLY=true
            shift
            ;;
        --frontend-only)
            FRONTEND_ONLY=true
            shift
            ;;
        --background|-b)
            BACKGROUND=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --prod, --production    Run in production mode"
            echo "  --backend-only          Run only the backend service"
            echo "  --frontend-only         Run only the frontend service"
            echo "  --background, -b        Run services in background"
            echo "  --help, -h              Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                      Run both services in development mode"
            echo "  $0 --backend-only       Run only backend in development mode"
            echo "  $0 --prod               Run both services in production mode"
            echo "  $0 --background         Run both services in background"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Setup backend
if [[ $FRONTEND_ONLY != true ]]; then
    print_status "Setting up backend..."
    cd backend
    
    # Install backend dependencies
    print_status "Installing backend dependencies..."
    run_poetry install
    
    # Copy .env file if it doesn't exist
    if [[ ! -f .env ]]; then
        if [[ -f .env.example ]]; then
            print_status "Creating .env file from .env.example..."
            cp .env.example .env
            print_warning "Please review and edit backend/.env file as needed"
        else
            print_warning "No .env.example found, creating basic .env file..."
            echo "VXI11_ENABLE_MOCK=true" > .env
            echo "VXI11_AUTO_UNLOCK=true" >> .env
        fi
    fi
    
    cd ..
fi

# Setup frontend
if [[ $BACKEND_ONLY != true ]]; then
    print_status "Setting up frontend..."
    cd frontend
    
    # Install frontend dependencies
    print_status "Installing frontend dependencies..."
    npm install
    
    cd ..
fi

# Start services
print_status "Starting services in $MODE mode..."

if [[ $FRONTEND_ONLY != true ]]; then
    print_status "Starting backend service..."
    cd backend
    
    if [[ $BACKGROUND == true ]]; then
        run_poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > ../backend.log 2>&1 &
        BACKEND_PID=$!
        print_success "Backend started in background (PID: $BACKEND_PID)"
        print_status "Backend logs: tail -f backend.log"
    else
        run_poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &
        BACKEND_PID=$!
        print_success "Backend started (PID: $BACKEND_PID)"
    fi
    
    cd ..
    
    # Wait a moment for backend to start
    sleep 2
fi

if [[ $BACKEND_ONLY != true ]]; then
    print_status "Starting frontend service..."
    cd frontend
    
    if [[ $MODE == "prod" ]]; then
        # Build for production
        print_status "Building frontend for production..."
        npm run build
        
        # Serve production build (requires serve package)
        if command_exists serve; then
            if [[ $BACKGROUND == true ]]; then
                serve -s dist -l 3000 > ../frontend.log 2>&1 &
                FRONTEND_PID=$!
                print_success "Frontend production server started in background (PID: $FRONTEND_PID)"
                print_status "Frontend logs: tail -f frontend.log"
            else
                serve -s dist -l 3000 &
                FRONTEND_PID=$!
                print_success "Frontend production server started (PID: $FRONTEND_PID)"
            fi
        else
            print_warning "Production mode requested but 'serve' package not found"
            print_status "Install serve: npm install -g serve"
            print_status "Falling back to development mode..."
            if [[ $BACKGROUND == true ]]; then
                npm run dev > ../frontend.log 2>&1 &
                FRONTEND_PID=$!
                print_success "Frontend dev server started in background (PID: $FRONTEND_PID)"
            else
                npm run dev &
                FRONTEND_PID=$!
                print_success "Frontend dev server started (PID: $FRONTEND_PID)"
            fi
        fi
    else
        # Development mode
        if [[ $BACKGROUND == true ]]; then
            npm run dev > ../frontend.log 2>&1 &
            FRONTEND_PID=$!
            print_success "Frontend dev server started in background (PID: $FRONTEND_PID)"
            print_status "Frontend logs: tail -f frontend.log"
        else
            npm run dev &
            FRONTEND_PID=$!
            print_success "Frontend dev server started (PID: $FRONTEND_PID)"
        fi
    fi
    
    cd ..
fi

# Display service information
echo ""
print_success "Services started successfully!"
echo ""

if [[ $FRONTEND_ONLY != true ]]; then
    echo -e "${GREEN}Backend:${NC}"
    echo "  URL: http://localhost:8000"
    echo "  API Documentation: http://localhost:8000/docs"
    echo "  Health Check: http://localhost:8000/api/health"
fi

if [[ $BACKEND_ONLY != true ]]; then
    echo -e "${GREEN}Frontend:${NC}"
    echo "  URL: http://localhost:3000"
fi

echo ""
if [[ $BACKGROUND == true ]]; then
    print_status "Services are running in background"
    if [[ $FRONTEND_ONLY != true ]]; then
        echo "  Backend PID: $BACKEND_PID"
    fi
    if [[ $BACKEND_ONLY != true ]]; then
        echo "  Frontend PID: $FRONTEND_PID"
    fi
    echo ""
    print_status "To stop services:"
    if [[ $FRONTEND_ONLY != true ]]; then
        echo "  kill $BACKEND_PID"
    fi
    if [[ $BACKEND_ONLY != true ]]; then
        echo "  kill $FRONTEND_PID"
    fi
    echo ""
    print_status "Log files:"
    if [[ $FRONTEND_ONLY != true ]]; then
        echo "  Backend: backend.log"
    fi
    if [[ $BACKEND_ONLY != true ]]; then
        echo "  Frontend: frontend.log"
    fi
else
    print_status "Press Ctrl+C to stop all services"
    echo ""
    
    # Wait for background processes if not in background mode
    if [[ -n $BACKEND_PID || -n $FRONTEND_PID ]]; then
        wait
    fi
fi