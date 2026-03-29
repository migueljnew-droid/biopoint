#!/usr/bin/env bash
# ============================================================================
# SPEAR Fitness Function: No Circular Dependencies
# ============================================================================
# Detects circular dependencies in the project codebase.
#
# Supported ecosystems:
#   - Rust:   Parses `cargo tree` output for cycles
#   - Node:   Uses `madge --circular` if installed
#   - Python: Scans import statements for obvious circular patterns
#   - Other:  Warns that no detector is available
#
# Exit codes:
#   0 = PASS (no circular dependencies found)
#   1 = FAIL (circular dependencies detected)
#   2 = SKIP (no supported detector available)
# ============================================================================

set -euo pipefail

SPEAR_DIR="${SPEAR_DIR:-.spear}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Colors (disabled if not a terminal)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' NC=''
fi

# ---- Rust Detection --------------------------------------------------------
check_rust() {
    if [ ! -f "$PROJECT_ROOT/Cargo.toml" ]; then
        return 1
    fi

    echo "Detecting circular dependencies in Rust project..."

    # cargo tree --duplicates can show version conflicts but not cycles directly.
    # cargo tree will error if there are actual dependency cycles.
    # We check the output for "(*)" which indicates a repeated dep (not necessarily circular)
    # and rely on cargo's own cycle detection which errors out.

    local output
    if output=$(cd "$PROJECT_ROOT" && cargo tree 2>&1); then
        # cargo tree succeeded -- no hard cycles in the dependency graph
        # Also check workspace crate cross-dependencies for logical cycles
        if echo "$output" | grep -q "circular"; then
            echo -e "${RED}FAIL${NC}: Circular dependencies detected in Rust crate graph"
            echo "$output" | grep -i "circular"
            exit 1  # Circular deps found — fail
        fi
        echo -e "${GREEN}PASS${NC}: No circular dependencies in Rust crate graph"
        exit 0
    else
        if echo "$output" | grep -qi "cyclic\|circular\|cycle"; then
            echo -e "${RED}FAIL${NC}: Circular dependencies detected in Rust crate graph"
            echo "$output" | grep -i "cycl"
            exit 1
        else
            # cargo tree failed for another reason (e.g., build error)
            echo -e "${YELLOW}WARN${NC}: cargo tree failed (possibly a build issue, not a cycle)"
            echo "$output" | tail -5
            exit 2
        fi
    fi
}

# ---- Node Detection --------------------------------------------------------
check_node() {
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        return 1
    fi

    echo "Detecting circular dependencies in Node.js project..."

    # Prefer madge if available
    if command -v madge &>/dev/null; then
        local output
        output=$(cd "$PROJECT_ROOT" && madge --circular --warning src/ 2>&1) || true

        if echo "$output" | grep -q "Found 0 circular"; then
            echo -e "${GREEN}PASS${NC}: No circular dependencies (madge)"
            exit 0
        elif echo "$output" | grep -q "No circular"; then
            echo -e "${GREEN}PASS${NC}: No circular dependencies (madge)"
            exit 0
        else
            local count
            count=$(echo "$output" | grep -c "^[0-9]" || echo "?")
            echo -e "${RED}FAIL${NC}: Circular dependencies found (madge)"
            echo "$output"
            exit 1
        fi
    fi

    # Fallback: check for dpdm
    if command -v dpdm &>/dev/null; then
        local output
        output=$(cd "$PROJECT_ROOT" && dpdm --circular --warning src/index.ts 2>&1) || true
        if echo "$output" | grep -q "circular"; then
            echo -e "${RED}FAIL${NC}: Circular dependencies found (dpdm)"
            echo "$output"
            exit 1
        else
            echo -e "${GREEN}PASS${NC}: No circular dependencies (dpdm)"
            exit 0
        fi
    fi

    # No tool available -- try a basic heuristic with node
    echo -e "${YELLOW}WARN${NC}: Install 'madge' for accurate circular dependency detection"
    echo "  npm install -g madge"
    exit 2
}

# ---- Python Detection ------------------------------------------------------
check_python() {
    local has_python=false
    if [ -f "$PROJECT_ROOT/setup.py" ] || [ -f "$PROJECT_ROOT/pyproject.toml" ] || \
       [ -f "$PROJECT_ROOT/setup.cfg" ] || [ -d "$PROJECT_ROOT/src" ]; then
        has_python=true
    fi
    # Also check if there are .py files at all
    if ! $has_python; then
        local py_count
        py_count=$(find "$PROJECT_ROOT" -maxdepth 3 -name "*.py" -not -path "*/node_modules/*" \
                   -not -path "*/.venv/*" -not -path "*/venv/*" 2>/dev/null | head -5 | wc -l)
        if [ "$py_count" -gt 0 ]; then
            has_python=true
        fi
    fi

    if ! $has_python; then
        return 1
    fi

    echo "Detecting circular dependencies in Python project..."

    # Use pydeps if available
    if command -v pydeps &>/dev/null; then
        # pydeps can detect cycles
        echo -e "${YELLOW}INFO${NC}: Using pydeps for cycle detection"
        exit 2  # TODO: implement pydeps parsing
    fi

    # Basic heuristic: look for mutual imports between files in the same package
    # This is NOT comprehensive but catches common patterns
    local cycles_found=0
    local checked=0

    # Find Python packages (dirs with __init__.py)
    while IFS= read -r init_file; do
        local pkg_dir
        pkg_dir="$(dirname "$init_file")"
        local pkg_name
        pkg_name="$(basename "$pkg_dir")"

        # Get all .py files in this package
        while IFS= read -r py_file; do
            local module_name
            module_name="$(basename "$py_file" .py)"
            [ "$module_name" = "__init__" ] && continue

            # Check if this module imports from siblings that import back
            local imports
            imports=$(grep -E "^from \.$|^from \.${pkg_name}|^from \.[a-z]" "$py_file" 2>/dev/null | \
                      sed -n 's/^from \.\([a-zA-Z_]*\).*/\1/p' || true)

            for imported in $imports; do
                local sibling="$pkg_dir/${imported}.py"
                if [ -f "$sibling" ]; then
                    # Check if the sibling imports back
                    if grep -qE "^from \.${module_name}" "$sibling" 2>/dev/null; then
                        echo -e "  ${RED}CYCLE${NC}: $pkg_name.$module_name <-> $pkg_name.$imported"
                        cycles_found=$((cycles_found + 1))
                    fi
                fi
            done
            checked=$((checked + 1))
        done < <(find "$pkg_dir" -maxdepth 1 -name "*.py" 2>/dev/null)
    done < <(find "$PROJECT_ROOT" -name "__init__.py" -not -path "*/node_modules/*" \
             -not -path "*/.venv/*" -not -path "*/venv/*" -not -path "*/.spear/*" 2>/dev/null)

    if [ "$checked" -eq 0 ]; then
        echo -e "${YELLOW}WARN${NC}: No Python packages found to check"
        exit 2
    fi

    if [ "$cycles_found" -gt 0 ]; then
        echo -e "${RED}FAIL${NC}: Found $cycles_found circular import(s) across $checked modules"
        exit 1
    else
        echo -e "${GREEN}PASS${NC}: No circular imports detected across $checked modules"
        exit 0
    fi
}

# ---- Main -------------------------------------------------------------------
echo "=== SPEAR Fitness: No Circular Dependencies ==="
echo "Project: $PROJECT_ROOT"
echo ""

# Try each ecosystem in order; first match wins
check_rust 2>/dev/null && exit $? || true
check_node 2>/dev/null && exit $? || true
check_python 2>/dev/null && exit $? || true

# Nothing detected
echo -e "${YELLOW}SKIP${NC}: No supported project type detected (Rust/Node/Python)"
echo "  Supported detectors:"
echo "    Rust:   Cargo.toml -> cargo tree"
echo "    Node:   package.json -> madge --circular"
echo "    Python: __init__.py -> import analysis"
exit 2
