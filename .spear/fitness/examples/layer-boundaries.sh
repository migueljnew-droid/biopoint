#!/usr/bin/env bash
# ============================================================================
# SPEAR Fitness Function: Layer Boundary Enforcement
# ============================================================================
# Enforces architectural layer boundaries by checking that source files do not
# import from disallowed layers.
#
# Layer rules define which directories can import from which other directories.
# For example, UI code should not import from database code, and API handlers
# should not import from UI components.
#
# Configuration:
#   1. From .spear/config.json under "layer_boundaries" key
#   2. From environment variable SPEAR_LAYER_RULES (JSON string)
#   3. Falls back to common defaults if neither is set
#
# Config format (in .spear/config.json):
#   {
#     "layer_boundaries": {
#       "layers": {
#         "ui":  { "path": "src/ui",  "can_import": ["shared", "types"] },
#         "api": { "path": "src/api", "can_import": ["db", "shared", "types"] },
#         "db":  { "path": "src/db",  "can_import": ["shared", "types"] }
#       }
#     }
#   }
#
# Each layer specifies a path and which other layers it CAN import from.
# Any import from a layer NOT in the can_import list is a violation.
#
# Exit codes:
#   0 = PASS (no boundary violations)
#   1 = FAIL (boundary violations found)
#   2 = SKIP (no layer config or no source files)
# ============================================================================

set -euo pipefail

SPEAR_DIR="${SPEAR_DIR:-.spear}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
CONFIG_FILE="$PROJECT_ROOT/$SPEAR_DIR/config.json"

# Colors
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    CYAN='\033[0;36m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' CYAN='' NC=''
fi

# ---- Load layer configuration -----------------------------------------------
# We need jq for JSON parsing of layer config
HAS_JQ=false
if command -v jq &>/dev/null; then
    HAS_JQ=true
fi

# Temporary files for layer data
LAYER_NAMES_FILE=$(mktemp)
LAYER_PATHS_FILE=$(mktemp)
LAYER_ALLOWED_FILE=$(mktemp)
trap 'rm -f "$LAYER_NAMES_FILE" "$LAYER_PATHS_FILE" "$LAYER_ALLOWED_FILE"' EXIT

load_config() {
    # Try .spear/config.json first
    if [ -f "$CONFIG_FILE" ] && $HAS_JQ; then
        local has_layers
        has_layers=$(jq -r '.layer_boundaries.layers // empty' "$CONFIG_FILE" 2>/dev/null)
        if [ -n "$has_layers" ] && [ "$has_layers" != "null" ]; then
            echo "  Config: $CONFIG_FILE"

            # Extract layer names, paths, and allowed imports
            jq -r '.layer_boundaries.layers | keys[]' "$CONFIG_FILE" > "$LAYER_NAMES_FILE"
            jq -r '.layer_boundaries.layers | to_entries[] | "\(.key)=\(.value.path)"' "$CONFIG_FILE" > "$LAYER_PATHS_FILE"
            jq -r '.layer_boundaries.layers | to_entries[] | "\(.key)=\(.value.can_import | join(","))"' "$CONFIG_FILE" > "$LAYER_ALLOWED_FILE"
            return 0
        fi
    fi

    # Try SPEAR_LAYER_RULES env var
    if [ -n "${SPEAR_LAYER_RULES:-}" ] && $HAS_JQ; then
        echo "  Config: SPEAR_LAYER_RULES env var"
        echo "$SPEAR_LAYER_RULES" | jq -r '.layers | keys[]' > "$LAYER_NAMES_FILE" 2>/dev/null
        echo "$SPEAR_LAYER_RULES" | jq -r '.layers | to_entries[] | "\(.key)=\(.value.path)"' > "$LAYER_PATHS_FILE" 2>/dev/null
        echo "$SPEAR_LAYER_RULES" | jq -r '.layers | to_entries[] | "\(.key)=\(.value.can_import | join(","))"' > "$LAYER_ALLOWED_FILE" 2>/dev/null
        return 0
    fi

    # Auto-detect common patterns
    echo "  Config: auto-detected defaults"
    auto_detect_layers
}

# ---- Auto-detect common layer patterns --------------------------------------
auto_detect_layers() {
    local found=false

    # Common patterns: src/ui, src/api, src/db, src/shared, src/types
    # Also: app/ui, app/api, lib/, etc.
    # Also: components/, pages/, services/, models/, utils/

    # Check for src/ based layout
    if [ -d "$PROJECT_ROOT/src" ]; then
        local layers=()
        local paths=()

        for dir in ui components pages views frontend; do
            if [ -d "$PROJECT_ROOT/src/$dir" ]; then
                layers+=("ui")
                echo "ui=$PROJECT_ROOT/src/$dir" >> "$LAYER_PATHS_FILE"
                echo "ui" >> "$LAYER_NAMES_FILE"
                echo "ui=shared,types,utils,lib,models" >> "$LAYER_ALLOWED_FILE"
                found=true
                break
            fi
        done

        for dir in api routes handlers controllers; do
            if [ -d "$PROJECT_ROOT/src/$dir" ]; then
                echo "api=$PROJECT_ROOT/src/$dir" >> "$LAYER_PATHS_FILE"
                echo "api" >> "$LAYER_NAMES_FILE"
                echo "api=db,models,shared,types,utils,lib,services" >> "$LAYER_ALLOWED_FILE"
                found=true
                break
            fi
        done

        for dir in db database models data; do
            if [ -d "$PROJECT_ROOT/src/$dir" ]; then
                echo "db=$PROJECT_ROOT/src/$dir" >> "$LAYER_PATHS_FILE"
                echo "db" >> "$LAYER_NAMES_FILE"
                echo "db=shared,types,utils,lib" >> "$LAYER_ALLOWED_FILE"
                found=true
                break
            fi
        done
    fi

    # Check for Rust crate layout (src/lib.rs + modules)
    if [ -f "$PROJECT_ROOT/src/lib.rs" ] || [ -f "$PROJECT_ROOT/src/main.rs" ]; then
        # For Rust, we look at mod declarations and use statements
        # This is a simplified check -- real enforcement would use cargo-deny or similar
        found=true
        if [ "$(wc -l < "$LAYER_NAMES_FILE")" -eq 0 ]; then
            # No layers detected, skip
            found=false
        fi
    fi

    if ! $found; then
        return 1
    fi

    return 0
}

# ---- Get the layer name for a given file path --------------------------------
get_layer_for_file() {
    local file="$1"
    while IFS='=' read -r name path; do
        if echo "$file" | grep -q "$path"; then
            echo "$name"
            return 0
        fi
    done < "$LAYER_PATHS_FILE"
    echo ""
}

# ---- Get allowed imports for a layer ----------------------------------------
get_allowed_imports() {
    local layer="$1"
    while IFS='=' read -r name allowed; do
        if [ "$name" = "$layer" ]; then
            echo "$allowed"
            return
        fi
    done < "$LAYER_ALLOWED_FILE"
    echo ""
}

# ---- Extract imports from a file --------------------------------------------
extract_imports() {
    local file="$1"

    # Match various import patterns:
    # JavaScript/TypeScript: import ... from '...', require('...')
    # Python: from X import Y, import X
    # Rust: use crate::..., mod ...
    # Go: import "..."

    local ext="${file##*.}"
    case "$ext" in
        js|jsx|ts|tsx|mjs|cjs)
            # ES imports: from './path' or from '../path' or from 'package/path'
            grep -oE "from ['\"]([^'\"]+)['\"]" "$file" 2>/dev/null | sed "s/from ['\"]//;s/['\"]$//" || true
            # CommonJS requires
            grep -oE "require\(['\"]([^'\"]+)['\"]\)" "$file" 2>/dev/null | sed "s/require(['\"]//;s/['\"]\)$//" || true
            ;;
        py)
            # from X import Y
            grep -oE "^from [a-zA-Z_.]+ import" "$file" 2>/dev/null | sed 's/^from //;s/ import$//' || true
            # import X
            grep -oE "^import [a-zA-Z_.]+" "$file" 2>/dev/null | sed 's/^import //' || true
            ;;
        rs)
            # use crate::module
            grep -oE "use crate::[a-zA-Z_]+" "$file" 2>/dev/null | sed 's/use crate:://' || true
            # mod module
            grep -oE "^mod [a-zA-Z_]+" "$file" 2>/dev/null | sed 's/^mod //' || true
            ;;
        go)
            # import "path/to/package"
            grep -oE '"[a-zA-Z0-9_./-]+"' "$file" 2>/dev/null | tr -d '"' || true
            ;;
    esac
}

# ---- Check if an import path references a specific layer --------------------
import_references_layer() {
    local import_path="$1"
    local target_layer="$2"

    # Get the path for the target layer
    while IFS='=' read -r name path; do
        if [ "$name" = "$target_layer" ]; then
            # Check if the import path contains the layer's directory name
            local dir_name
            dir_name=$(basename "$path")
            if echo "$import_path" | grep -qiE "(^|[/.])(${dir_name})([/.]|$)"; then
                return 0
            fi
        fi
    done < "$LAYER_PATHS_FILE"

    return 1
}

# ---- Main -------------------------------------------------------------------
echo "=== SPEAR Fitness: Layer Boundary Enforcement ==="
echo "Project: $PROJECT_ROOT"
echo ""

# Load configuration
if ! load_config; then
    echo -e "${YELLOW}SKIP${NC}: No layer configuration found"
    echo ""
    echo "  Configure layers in .spear/config.json:"
    echo '  {'
    echo '    "layer_boundaries": {'
    echo '      "layers": {'
    echo '        "ui":  { "path": "src/ui",  "can_import": ["shared", "types"] },'
    echo '        "api": { "path": "src/api", "can_import": ["db", "shared"] },'
    echo '        "db":  { "path": "src/db",  "can_import": ["shared"] }'
    echo '      }'
    echo '    }'
    echo '  }'
    exit 2
fi

# Show detected layers
echo ""
echo "  Layers:"
while IFS='=' read -r name path; do
    local_allowed=""
    while IFS='=' read -r aname aallowed; do
        if [ "$aname" = "$name" ]; then
            local_allowed="$aallowed"
            break
        fi
    done < "$LAYER_ALLOWED_FILE"
    echo "    $name ($path) -> can import: [$local_allowed]"
done < "$LAYER_PATHS_FILE"
echo ""

# Scan files for violations
violations=0
files_checked=0
all_layers=$(cat "$LAYER_NAMES_FILE")

while IFS='=' read -r layer_name layer_path; do
    if [ ! -d "$layer_path" ] && [ ! -d "$PROJECT_ROOT/$layer_path" ]; then
        continue
    fi

    # Resolve to absolute path
    local_path="$layer_path"
    if [ ! -d "$local_path" ]; then
        local_path="$PROJECT_ROOT/$layer_path"
    fi

    allowed=$(get_allowed_imports "$layer_name")

    # Find source files in this layer
    while IFS= read -r source_file; do
        files_checked=$((files_checked + 1))
        imports=$(extract_imports "$source_file")

        for import in $imports; do
            # Check each import against all layers
            for other_layer in $all_layers; do
                [ "$other_layer" = "$layer_name" ] && continue  # Same layer is always OK

                if import_references_layer "$import" "$other_layer"; then
                    # This import references another layer -- check if it's allowed
                    if ! echo ",$allowed," | grep -q ",$other_layer,"; then
                        violations=$((violations + 1))
                        local rel_file
                        rel_file="${source_file#$PROJECT_ROOT/}"
                        echo -e "  ${RED}VIOLATION${NC}: $rel_file"
                        echo "    Layer '$layer_name' imports from '$other_layer' (not in allowed list)"
                        echo "    Import: $import"
                        echo ""
                    fi
                fi
            done
        done
    done < <(find "$local_path" -type f \( -name "*.js" -o -name "*.jsx" -o -name "*.ts" \
             -o -name "*.tsx" -o -name "*.py" -o -name "*.rs" -o -name "*.go" \) \
             -not -path "*/node_modules/*" -not -path "*/.venv/*" \
             -not -path "*/target/*" -not -path "*/__pycache__/*" 2>/dev/null)
done < "$LAYER_PATHS_FILE"

# Results
echo "  Files checked: $files_checked"
echo ""

if [ "$files_checked" -eq 0 ]; then
    echo -e "${YELLOW}SKIP${NC}: No source files found in configured layer paths"
    exit 2
fi

if [ "$violations" -eq 0 ]; then
    echo -e "${GREEN}PASS${NC}: No layer boundary violations found across $files_checked files"
    exit 0
else
    echo -e "${RED}FAIL${NC}: Found $violations layer boundary violation(s) across $files_checked files"
    exit 1
fi
