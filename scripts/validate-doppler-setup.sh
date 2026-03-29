#!/bin/bash

# BioPoint Doppler Setup Validation Script
# Validates that the Doppler implementation is correctly configured

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
WARNINGS=0

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
    ((TESTS_PASSED++))
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
    ((WARNINGS++))
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
    ((TESTS_FAILED++))
}

log_header() {
    echo ""
    echo -e "${BLUE}🔍 $1${NC}"
    echo "=================================="
}

# Get project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Test functions
test_file_exists() {
    local file="$1"
    local description="$2"
    
    if [[ -f "$PROJECT_ROOT/$file" ]]; then
        log_success "$description exists"
        return 0
    else
        log_error "$description missing: $file"
        return 1
    fi
}

test_file_executable() {
    local file="$1"
    local description="$2"
    
    if [[ -x "$PROJECT_ROOT/$file" ]]; then
        log_success "$description is executable"
        return 0
    else
        log_error "$description not executable: $file"
        return 1
    fi
}

test_yaml_valid() {
    local file="$1"
    local description="$2"
    
    if command -v python3 &> /dev/null; then
        if python3 -c "import yaml; yaml.safe_load(open('$PROJECT_ROOT/$file'))" 2>/dev/null; then
            log_success "$description YAML is valid"
            return 0
        else
            log_error "$description YAML is invalid: $file"
            return 1
        fi
    else
        log_warning "Python3 not available, skipping YAML validation for $file"
        return 0
    fi
}

test_json_valid() {
    local file="$1"
    local description="$2"
    
    if command -v jq &> /dev/null; then
        if jq empty "$PROJECT_ROOT/$file" 2>/dev/null; then
            log_success "$description JSON is valid"
            return 0
        else
            log_error "$description JSON is invalid: $file"
            return 1
        fi
    else
        log_warning "jq not available, skipping JSON validation for $file"
        return 0
    fi
}

test_doppler_cli() {
    log_info "Checking Doppler CLI installation..."
    
    if command -v doppler &> /dev/null; then
        local version=$(doppler --version 2>/dev/null || echo "unknown")
        log_success "Doppler CLI installed (version: $version)"
        return 0
    else
        log_error "Doppler CLI not installed"
        return 1
    fi
}

test_doppler_auth() {
    log_info "Checking Doppler authentication..."
    
    if doppler auth &> /dev/null; then
        log_success "Doppler CLI is authenticated"
        return 0
    else
        log_error "Doppler CLI not authenticated. Run: doppler login"
        return 1
    fi
}

test_package_json_scripts() {
    log_info "Checking package.json scripts..."
    
    local package_json="$PROJECT_ROOT/package.json"
    
    if [[ ! -f "$package_json" ]]; then
        log_error "package.json not found"
        return 1
    fi
    
    # Check for Doppler-enabled scripts
    local scripts_to_check=(
        "dev:api:doppler"
        "build:api:doppler"
        "db:generate:doppler"
        "secrets:list"
        "secrets:audit"
    )
    
    local found_scripts=0
    for script in "${scripts_to_check[@]}"; do
        if grep -q "\"$script\"" "$package_json"; then
            log_success "Found script: $script"
            ((found_scripts++))
        else
            log_warning "Script not found: $script"
        fi
    done
    
    # Check if basic Doppler pattern exists
    if grep -q "doppler run" "$package_json"; then
        log_success "Doppler integration found in package.json"
        return 0
    else
        log_error "No Doppler integration found in package.json"
        return 1
    fi
}

test_gitignore_updated() {
    log_info "Checking .gitignore for Doppler files..."
    
    local gitignore="$PROJECT_ROOT/.gitignore"
    
    if [[ ! -f "$gitignore" ]]; then
        log_error ".gitignore not found"
        return 1
    fi
    
    local patterns_to_check=(
        ".doppler/"
        "doppler-service-token"
        "*.backup"
    )
    
    local found_patterns=0
    for pattern in "${patterns_to_check[@]}"; do
        if grep -q "$pattern" "$gitignore"; then
            log_success "Found pattern in .gitignore: $pattern"
            ((found_patterns++))
        else
            log_warning "Pattern not found in .gitignore: $pattern"
        fi
    done
    
    return 0
}

test_github_workflows() {
    log_info "Checking GitHub Actions workflows..."
    
    local workflows_dir="$PROJECT_ROOT/.github/workflows"
    
    if [[ ! -d "$workflows_dir" ]]; then
        log_error "GitHub workflows directory not found"
        return 1
    fi
    
    # Check for secrets audit workflow
    if [[ -f "$workflows_dir/secrets-audit.yml" ]]; then
        log_success "Secrets audit workflow found"
        
        # Check if workflow contains Doppler integration
        if grep -q "doppler" "$workflows_dir/secrets-audit.yml"; then
            log_success "Doppler integration found in secrets audit workflow"
        else
            log_warning "Doppler integration not found in secrets audit workflow"
        fi
    else
        log_error "Secrets audit workflow not found"
        return 1
    fi
    
    return 0
}

test_gitleaks_config() {
    log_info "Checking GitLeaks configuration..."
    
    local gitleaks_config="$PROJECT_ROOT/.gitleaks.toml"
    
    if [[ ! -f "$gitleaks_config" ]]; then
        log_error "GitLeaks configuration not found"
        return 1
    fi
    
    # Check for healthcare-specific rules
    if grep -q "healthcare\|phi\|hipaa" "$gitleaks_config"; then
        log_success "Healthcare-specific rules found in GitLeaks config"
    else
        log_warning "Healthcare-specific rules not found in GitLeaks config"
    fi
    
    return 0
}

test_documentation() {
    log_info "Checking documentation..."
    
    local docs_dir="$PROJECT_ROOT/docs"
    
    if [[ ! -d "$docs_dir" ]]; then
        log_warning "Documentation directory not found"
        return 0
    fi
    
    # Check for secrets management documentation
    if [[ -f "$docs_dir/secrets-management.md" ]]; then
        log_success "Secrets management documentation found"
    else
        log_warning "Secrets management documentation not found"
    fi
    
    # Check for implementation summary
    if [[ -f "$PROJECT_ROOT/DOPPLER_IMPLEMENTATION_SUMMARY.md" ]]; then
        log_success "Implementation summary found"
    else
        log_warning "Implementation summary not found"
    fi
    
    return 0
}

test_env_files_excluded() {
    log_info "Checking for .env files in repository..."
    
    # Look for any .env files that might have been accidentally committed
    env_files=$(find "$PROJECT_ROOT" -name ".env*" -type f ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/.doppler/*" ! -name "*.example" ! -name "*.template" 2>/dev/null || true)
    
    if [[ -n "$env_files" ]]; then
        log_error "Found .env files in repository (security risk):"
        echo "$env_files"
        return 1
    fi
    
    log_success "No .env files found in repository"
    return 0
}

# Main validation function
main() {
    echo -e "${BLUE}🔍 BioPoint Doppler Setup Validation${NC}"
    echo "======================================"
    echo "Validating Doppler implementation for BioPoint..."
    echo ""
    
    # Test core configuration files
    log_header "Core Configuration Files"
    test_file_exists "doppler.yaml" "Doppler project configuration"
    test_yaml_valid "doppler.yaml" "Doppler configuration"
    
    # Test scripts
    log_header "Migration & Setup Scripts"
    test_file_exists "scripts/migrate-to-doppler.sh" "Migration script"
    test_file_executable "scripts/migrate-to-doppler.sh" "Migration script"
    test_file_exists "scripts/doppler-setup.sh" "Setup script"
    test_file_executable "scripts/doppler-setup.sh" "Setup script"
    
    # Test environment scripts
    log_header "Environment Scripts"
    test_file_exists "scripts/doppler/dev.sh" "Development script"
    test_file_executable "scripts/doppler/dev.sh" "Development script"
    test_file_exists "scripts/doppler/staging.sh" "Staging script"
    test_file_executable "scripts/doppler/staging.sh" "Staging script"
    test_file_exists "scripts/doppler/production.sh" "Production script"
    test_file_executable "scripts/doppler/production.sh" "Production script"
    
    # Test package.json
    log_header "Package.json Configuration"
    test_package_json_scripts
    
    # Test Git configuration
    log_header "Git Configuration"
    test_gitignore_updated
    test_env_files_excluded
    
    # Test GitHub workflows
    log_header "CI/CD Configuration"
    test_github_workflows
    
    # Test security configuration
    log_header "Security Configuration"
    test_gitleaks_config
    test_file_exists ".gitleaks.toml" "GitLeaks configuration"
    
    # Test documentation
    log_header "Documentation"
    test_documentation
    
    # Test Doppler CLI (optional)
    log_header "Doppler CLI Status"
    test_doppler_cli
    if command -v doppler &> /dev/null; then
        test_doppler_auth
    fi
    
    # Summary
    echo ""
    echo -e "${BLUE}📊 Validation Summary${NC}"
    echo "=================================="
    echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
    echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
    echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
    echo ""
    
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}🎉 All critical tests passed!${NC}"
        echo "Your Doppler implementation looks good."
        
        if [[ $WARNINGS -gt 0 ]]; then
            echo -e "${YELLOW}⚠️  There are some warnings to address.${NC}"
            echo "Review the warnings above for recommendations."
        fi
        
        echo ""
        echo "Next steps:"
        echo "1. Run the migration script: ./scripts/migrate-to-doppler.sh"
        echo "2. Test your application: doppler run -- npm run dev:api"
        echo "3. Set up CI/CD integration with Doppler service tokens"
        
        exit 0
    else
        echo -e "${RED}❌ Some tests failed.${NC}"
        echo "Please address the issues above before proceeding."
        exit 1
    fi
}

# Run validation
main "$@"