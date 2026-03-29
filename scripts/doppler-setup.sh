#!/bin/bash

# BioPoint Doppler Quick Setup Script
# This script helps developers get started with Doppler quickly

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Welcome message
echo -e "${BLUE}🚀 BioPoint Doppler Setup${NC}"
echo "This script will help you set up Doppler for secure secrets management."
echo ""

# Check if Doppler CLI is installed
if ! command -v doppler &> /dev/null; then
    log_info "Doppler CLI not found. Installing..."
    
    # Detect OS and install accordingly
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command -v brew &> /dev/null; then
            brew install dopplerhq/cli/doppler
        else
            log_error "Homebrew not found. Please install Doppler manually:"
            log_error "Visit: https://docs.doppler.com/docs/install-cli"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl -sLf --compressed "https://cli.doppler.com/install.sh" | sudo sh
    else
        log_error "Unsupported operating system. Please install Doppler manually:"
        log_error "Visit: https://docs.doppler.com/docs/install-cli"
        exit 1
    fi
    
    log_success "Doppler CLI installed successfully"
fi

# Check Doppler version
log_info "Doppler CLI version: $(doppler --version)"

# Authenticate with Doppler
echo ""
log_info "Step 1: Authenticate with Doppler"
echo "You'll be redirected to Doppler's website to login."
echo ""

if doppler auth; then
    log_success "Successfully authenticated with Doppler"
else
    log_error "Failed to authenticate with Doppler"
    exit 1
fi

# Setup project
echo ""
log_info "Step 2: Setup BioPoint project"
echo "This will configure your local environment to use the BioPoint Doppler project."
echo ""

if doppler setup; then
    log_success "Project setup completed"
else
    log_error "Failed to setup project"
    exit 1
fi

# Verify configuration
echo ""
log_info "Step 3: Verify configuration"

# Check if we can access secrets
if doppler secrets --json > /dev/null 2>&1; then
    secret_count=$(doppler secrets --json | jq -r 'keys | length')
    log_success "Successfully connected to Doppler project"
    log_info "Found $secret_count secrets in your configured environment"
else
    log_warning "Could not access secrets. You may need to:"
    log_warning "1. Create a Doppler project named 'biopoint'"
    log_warning "2. Add secrets to your environment"
    log_warning "3. Ensure you have the correct permissions"
fi

# Test with a simple command
echo ""
log_info "Step 4: Testing Doppler integration"

if doppler run --print-env | grep -q "DOPPLER_"; then
    log_success "Doppler is successfully injecting environment variables"
else
    log_warning "Doppler environment variables not detected"
fi

# Create helpful aliases
echo ""
log_info "Step 5: Creating helpful shortcuts"

# Add to shell profile
SHELL_PROFILE=""
if [[ "$SHELL" == *"bash"* ]]; then
    SHELL_PROFILE="$HOME/.bashrc"
elif [[ "$SHELL" == *"zsh"* ]]; then
    SHELL_PROFILE="$HOME/.zshrc"
fi

if [[ -n "$SHELL_PROFILE" ]]; then
    # Check if aliases already exist
    if ! grep -q "biopoint-dev" "$SHELL_PROFILE" 2>/dev/null; then
        cat >> "$SHELL_PROFILE" << 'EOF'

# BioPoint Doppler shortcuts
alias biopoint-dev='doppler run --config dev -- npm run dev:api'
alias biopoint-staging='doppler run --config staging -- npm run build:api && doppler run --config staging -- npm start'
alias biopoint-secrets='doppler secrets'
alias biopoint-activity='doppler activity'
EOF
        log_success "Added BioPoint shortcuts to $SHELL_PROFILE"
        log_info "Run 'source $SHELL_PROFILE' to use the new shortcuts"
    fi
fi

# Final instructions
echo ""
echo -e "${GREEN}🎉 Doppler setup completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Test your setup: doppler run -- npm run dev:api"
echo "2. List your secrets: doppler secrets"
echo "3. View recent activity: doppler activity"
echo ""
echo "Useful commands:"
echo "  • doppler run -- npm run dev:api     # Start API with secrets"
echo "  • doppler run -- npm run db:migrate  # Run database migrations"
echo "  • doppler secrets set KEY value      # Set a secret"
echo "  • doppler secrets delete KEY         # Delete a secret"
echo ""
echo "Documentation:"
echo "  • Local: docs/secrets-management.md"
echo "  • Doppler: https://docs.doppler.com/"
echo ""

# Check if we're in the right directory
if [[ -f "package.json" ]] && grep -q "biopoint" package.json 2>/dev/null; then
    log_success "You're in the BioPoint project directory"
else
    log_warning "Navigate to your BioPoint project directory to use Doppler"
fi

log_info "Setup complete! Happy coding with secure secrets management. 🚀"