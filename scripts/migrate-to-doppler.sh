#!/bin/bash

# BioPoint Secrets Migration Script
# Migrates from .env files to Doppler secrets management
# CRITICAL: Review all secrets before migration

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/.doppler/backups/$(date +%Y%m%d_%H%M%S)"
MIGRATION_LOG="$BACKUP_DIR/migration.log"

# Doppler configuration
DOPPLER_PROJECT="biopoint"
ENVIRONMENTS=("dev" "staging" "production")

# Initialize logging
mkdir -p "$BACKUP_DIR"
touch "$MIGRATION_LOG"

log_to_file() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$MIGRATION_LOG"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Doppler CLI is installed
    if ! command -v doppler &> /dev/null; then
        log_error "Doppler CLI is not installed. Please install it first:"
        log_error "  brew install dopplerhq/cli/doppler"
        exit 1
    fi
    
    # Check if we're in the right directory
    if [[ ! -f "$PROJECT_ROOT/doppler.yaml" ]]; then
        log_error "doppler.yaml not found. Are you in the BioPoint project root?"
        exit 1
    fi
    
    # Check Doppler authentication
    if ! doppler auth &> /dev/null; then
        log_warning "Doppler CLI not authenticated. Please login first:"
        log_warning "  doppler login"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
    log_to_file "Prerequisites check passed"
}

# Detect existing .env files
detect_env_files() {
    log_info "Detecting existing .env files..."
    
    ENV_FILES=()
    
    # Common .env file locations
    local env_patterns=(
        "$PROJECT_ROOT/.env"
        "$PROJECT_ROOT/.env.local"
        "$PROJECT_ROOT/.env.development"
        "$PROJECT_ROOT/.env.staging"
        "$PROJECT_ROOT/.env.production"
        "$PROJECT_ROOT/apps/api/.env"
        "$PROJECT_ROOT/apps/mobile/.env"
        "$PROJECT_ROOT/db/.env"
        "$PROJECT_ROOT/packages/*/env"
    )
    
    for pattern in "${env_patterns[@]}"; do
        if [[ -f "$pattern" ]]; then
            ENV_FILES+=("$pattern")
            log_info "Found: $pattern"
        fi
    done
    
    # Find additional .env files
    while IFS= read -r -d '' file; do
        ENV_FILES+=("$file")
        log_info "Found: $file"
    done < <(find "$PROJECT_ROOT" -name ".env*" -type f ! -path "*/node_modules/*" ! -path "*/.git/*" -print0)
    
    if [[ ${#ENV_FILES[@]} -eq 0 ]]; then
        log_warning "No .env files found. Nothing to migrate."
        exit 0
    fi
    
    log_success "Found ${#ENV_FILES[@]} .env files"
    log_to_file "Found ${#ENV_FILES[@]} .env files: ${ENV_FILES[*]}"
}

# Backup existing .env files
backup_env_files() {
    log_info "Creating backups..."
    
    for env_file in "${ENV_FILES[@]}"; do
        if [[ -f "$env_file" ]]; then
            local backup_path="$BACKUP_DIR/$(echo "$env_file" | sed "s|$PROJECT_ROOT/||g" | tr '/' '_')"
            local backup_dir="$(dirname "$backup_path")"
            
            mkdir -p "$backup_dir"
            cp "$env_file" "$backup_path"
            
            log_success "Backed up: $env_file -> $backup_path"
            log_to_file "Backed up: $env_file -> $backup_path"
        fi
    done
    
    # Create a consolidated backup
    local consolidated_backup="$BACKUP_DIR/all-env-files.tar.gz"
    tar -czf "$consolidated_backup" -C "$PROJECT_ROOT" $(printf "%s " "${ENV_FILES[@]#$PROJECT_ROOT/}")
    
    log_success "Created consolidated backup: $consolidated_backup"
    log_to_file "Created consolidated backup: $consolidated_backup"
}

# Parse environment from file path or content
parse_environment() {
    local file_path="$1"
    local content="$2"
    
    # Check file name for environment hint
    if [[ "$file_path" =~ \.production\. ]] || [[ "$file_path" =~ \.prod\. ]]; then
        echo "production"
    elif [[ "$file_path" =~ \.staging\. ]]; then
        echo "staging"
    elif [[ "$file_path" =~ \.development\. ]] || [[ "$file_path" =~ \.dev\. ]]; then
        echo "dev"
    else
        # Default to dev for local development files
        echo "dev"
    fi
}

# Import secrets to Doppler
import_secrets() {
    log_info "Importing secrets to Doppler..."
    
    # Create Doppler project if it doesn't exist
    if ! doppler projects get "$DOPPLER_PROJECT" &> /dev/null; then
        log_info "Creating Doppler project: $DOPPLER_PROJECT"
        doppler projects create "$DOPPLER_PROJECT" --description "BioPoint Healthcare Data Platform"
    fi
    
    # Create environments if they don't exist
    for env in "${ENVIRONMENTS[@]}"; do
        if ! doppler configs get "$env" --project "$DOPPLER_PROJECT" &> /dev/null; then
            log_info "Creating environment: $env"
            doppler configs create "$env" --project "$DOPPLER_PROJECT" --environment "$env"
        fi
    done
    
    # Import secrets from each .env file
    for env_file in "${ENV_FILES[@]}"; do
        if [[ -f "$env_file" ]]; then
            log_info "Processing: $env_file"
            
            # Read file content (skip comments and empty lines)
            local content=""
            while IFS= read -r line; do
                # Skip comments and empty lines
                if [[ ! "$line" =~ ^[[:space:]]*# ]] && [[ -n "$line" ]]; then
                    content+="$line
"
                fi
            done < "$env_file"
            
            if [[ -n "$content" ]]; then
                local environment="$(parse_environment "$env_file" "$content")"
                
                log_info "Importing to Doppler environment: $environment"
                
                # Create temporary file for upload
                local temp_file="$BACKUP_DIR/$(basename "$env_file").tmp"
                echo "$content" > "$temp_file"
                
                # Upload to Doppler
                if doppler secrets upload --project "$DOPPLER_PROJECT" --config "$environment" < "$temp_file"; then
                    log_success "Imported secrets from $env_file to $environment environment"
                    log_to_file "Imported secrets from $env_file to $environment environment"
                else
                    log_error "Failed to import secrets from $env_file"
                    log_to_file "Failed to import secrets from $env_file"
                fi
                
                # Clean up temp file
                rm -f "$temp_file"
            fi
        fi
    done
}

# Verify import success
verify_import() {
    log_info "Verifying import success..."
    
    local verification_failed=false
    
    for env in "${ENVIRONMENTS[@]}"; do
        log_info "Verifying $environment environment..."
        
        # Get secret count from Doppler
        local doppler_secrets=$(doppler secrets --project "$DOPPLER_PROJECT" --config "$env" --json 2>/dev/null | jq -r 'keys | length' 2>/dev/null || echo "0")
        
        if [[ "$doppler_secrets" -gt 0 ]]; then
            log_success "Environment $env: $doppler_secrets secrets imported"
            log_to_file "Environment $env: $doppler_secrets secrets imported"
        else
            log_warning "Environment $env: No secrets found"
            log_to_file "Environment $env: No secrets found"
            verification_failed=true
        fi
    done
    
    if [[ "$verification_failed" == "true" ]]; then
        log_error "Verification failed for some environments"
        return 1
    fi
    
    log_success "Verification completed successfully"
}

# Update package.json scripts
update_scripts() {
    log_info "Updating package.json scripts to use Doppler..."
    
    # Backup original package.json
    cp "$PROJECT_ROOT/package.json" "$BACKUP_DIR/package.json.backup"
    
    # Update root package.json
    local temp_file="$BACKUP_DIR/package.json.new"
    
    # Read current package.json
    local package_json=$(cat "$PROJECT_ROOT/package.json")
    
    # Update scripts to use Doppler
    local updated_json=$(echo "$package_json" | jq '
    .scripts |= 
    {
        "dev:api": "doppler run -- npm run dev -w @biopoint/api",
        "dev:mobile": "doppler run -- npm run start -w @biopoint/mobile",
        "build:api": "doppler run -- npm run build -w @biopoint/api",
        "build:shared": "doppler run -- npm run build -w @biopoint/shared",
        "db:generate": "doppler run -- npm run generate -w @biopoint/db",
        "db:migrate": "doppler run -- npm run migrate -w @biopoint/db",
        "db:push": "doppler run -- npm run push -w @biopoint/db",
        "db:seed": "doppler run -- npm run seed -w @biopoint/db",
        "db:studio": "doppler run -- npm run studio -w @biopoint/db",
        "test": "doppler run -- turbo run test",
        "lint": "doppler run -- turbo run lint",
        "clean": "doppler run -- turbo run clean",
        "doppler:setup": "doppler setup",
        "doppler:login": "doppler login",
        "secrets:list": "doppler secrets",
        "secrets:audit": "doppler activity"
    }')
    
    # Write updated package.json
    echo "$updated_json" | jq '.' > "$temp_file"
    
    if [[ -s "$temp_file" ]]; then
        mv "$temp_file" "$PROJECT_ROOT/package.json"
        log_success "Updated package.json with Doppler-enabled scripts"
        log_to_file "Updated package.json with Doppler-enabled scripts"
    else
        log_error "Failed to update package.json"
        return 1
    fi
}

# Create environment-specific scripts
create_environment_scripts() {
    log_info "Creating environment-specific scripts..."
    
    local scripts_dir="$PROJECT_ROOT/scripts/doppler"
    mkdir -p "$scripts_dir"
    
    # Development script
    cat > "$scripts_dir/dev.sh" << 'EOF'
#!/bin/bash
# Development environment script
echo "Starting BioPoint in DEVELOPMENT mode..."
doppler run --config dev -- npm run dev:api
EOF

    # Staging script
    cat > "$scripts_dir/staging.sh" << 'EOF'
#!/bin/bash
# Staging environment script
echo "Starting BioPoint in STAGING mode..."
doppler run --config staging -- npm run build:api && doppler run --config staging -- npm start
EOF

    # Production script
    cat > "$scripts_dir/production.sh" << 'EOF'
#!/bin/bash
# Production environment script
echo "Starting BioPoint in PRODUCTION mode..."
doppler run --config production -- npm run build:api && doppler run --config production -- npm start
EOF

    # Make scripts executable
    chmod +x "$scripts_dir"/*.sh
    
    log_success "Created environment-specific scripts"
    log_to_file "Created environment-specific scripts"
}

# Generate rollback instructions
generate_rollback_instructions() {
    log_info "Generating rollback instructions..."
    
    local rollback_file="$BACKUP_DIR/ROLLBACK_INSTRUCTIONS.md"
    
    cat > "$rollback_file" << EOF
# Rollback Instructions

If you need to rollback the Doppler migration, follow these steps:

## Quick Rollback

1. **Restore package.json**
   \`\`\`bash
   cp "$BACKUP_DIR/package.json.backup" "$PROJECT_ROOT/package.json"
   \`\`\`

2. **Restore .env files**
   \`\`\`bash
   # Extract backup
   tar -xzf "$BACKUP_DIR/all-env-files.tar.gz" -C "$PROJECT_ROOT"
   \`\`\`

3. **Verify functionality**
   \`\`\`bash
   npm run dev:api
   \`\`\`

## Complete Rollback

1. **Remove Doppler configuration**
   \`\`\`bash
   rm -f "$PROJECT_ROOT/doppler.yaml"
   rm -rf "$PROJECT_ROOT/.doppler"
   rm -rf "$PROJECT_ROOT/scripts/doppler"
   \`\`\`

2. **Restore original scripts**
   Use the backup package.json or manually revert changes

3. **Delete Doppler project** (optional)
   \`\`\`bash
   doppler projects delete $DOPPLER_PROJECT
   \`\`\`

## Support

- Migration log: $MIGRATION_LOG
- Backup location: $BACKUP_DIR
- Original files: $BACKUP_DIR/all-env-files.tar.gz

If you encounter issues, check the migration log for detailed information.
EOF

    log_success "Generated rollback instructions: $rollback_file"
    log_to_file "Generated rollback instructions"
}

# Main migration process
main() {
    log_info "Starting BioPoint secrets migration to Doppler..."
    log_to_file "Migration started"
    
    # Display warning
    echo -e "${YELLOW}⚠️  IMPORTANT SECURITY NOTICE ⚠️${NC}"
    echo "This script will migrate your secrets to Doppler."
    echo "Make sure you have:"
    echo "1. Doppler account created"
    echo "2. Doppler CLI installed and authenticated"
    echo "3. Backup of all critical secrets"
    echo ""
    
    read -p "Do you want to continue? (yes/no): " -r
    if [[ ! "$REPLY" =~ ^[Yy][Ee][Ss]$ ]]; then
        log_info "Migration cancelled by user"
        exit 0
    fi
    
    # Execute migration steps
    check_prerequisites
    detect_env_files
    backup_env_files
    import_secrets
    verify_import
    update_scripts
    create_environment_scripts
    generate_rollback_instructions
    
    # Final success message
    log_success "Migration completed successfully!"
    log_to_file "Migration completed successfully"
    
    echo -e "${GREEN}🎉 Migration Complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Test your application: doppler run -- npm run dev:api"
    echo "2. Update your CI/CD pipelines to use Doppler"
    echo "3. Train your team on Doppler usage"
    echo "4. Set up monitoring and alerting"
    echo ""
    echo "Backup location: $BACKUP_DIR"
    echo "Rollback instructions: $BACKUP_DIR/ROLLBACK_INSTRUCTIONS.md"
    echo "Migration log: $MIGRATION_LOG"
    echo ""
    echo -e "${YELLOW}⚠️  Remember to:${NC}"
    echo "- Remove .env files from version control"
    echo "- Update .gitignore to exclude .env files"
    echo "- Set up service tokens for CI/CD"
    echo "- Configure secret rotation schedules"
}

# Error handling
trap 'log_error "Migration failed on line $LINENO"; exit 1' ERR

# Run main function
main "$@"