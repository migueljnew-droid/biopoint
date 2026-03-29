#!/usr/bin/env bash
# ============================================================================
# SPEAR Fitness Function: Test Coverage
# ============================================================================
# Measures test coverage and compares against the ratchet floor threshold.
#
# Supported ecosystems:
#   - Rust:   cargo tarpaulin or cargo llvm-cov
#   - Node:   jest --coverage, vitest --coverage, or nyc/c8
#   - Python: coverage.py
#
# Reads threshold from: .spear/ratchet/ratchet.json -> thresholds.test_coverage.value
# Default threshold: 70%
#
# Exit codes:
#   0 = PASS (coverage >= threshold)
#   1 = FAIL (coverage < threshold)
#   2 = SKIP (unable to measure coverage)
# ============================================================================

set -euo pipefail

SPEAR_DIR="${SPEAR_DIR:-.spear}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
RATCHET_FILE="$PROJECT_ROOT/$SPEAR_DIR/ratchet/ratchet.json"

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

# ---- Read threshold from ratchet -------------------------------------------
get_threshold() {
    local default_threshold=70

    if [ ! -f "$RATCHET_FILE" ]; then
        echo "$default_threshold"
        return
    fi

    # Try jq first, fall back to grep/sed
    if command -v jq &>/dev/null; then
        local val
        val=$(jq -r '.thresholds.test_coverage.value // empty' "$RATCHET_FILE" 2>/dev/null)
        if [ -n "$val" ] && [ "$val" != "null" ]; then
            echo "$val"
            return
        fi
    else
        # Basic extraction without jq
        local val
        val=$(grep -A2 '"test_coverage"' "$RATCHET_FILE" 2>/dev/null | \
              grep '"value"' | sed 's/.*: *\([0-9]*\).*/\1/' || true)
        if [ -n "$val" ]; then
            echo "$val"
            return
        fi
    fi

    echo "$default_threshold"
}

# ---- Compare coverage to threshold -----------------------------------------
# Floor direction: coverage must be >= threshold
check_result() {
    local coverage="$1"
    local threshold="$2"

    echo ""
    echo -e "  Coverage:  ${CYAN}${coverage}%${NC}"
    echo -e "  Threshold: ${CYAN}${threshold}%${NC} (floor)"

    # Integer comparison (strip decimals for simplicity)
    local cov_int="${coverage%%.*}"
    local thr_int="${threshold%%.*}"

    if [ "$cov_int" -ge "$thr_int" ]; then
        echo ""
        echo -e "${GREEN}PASS${NC}: Test coverage ${coverage}% >= ${threshold}% threshold"
        exit 0
    else
        local gap=$((thr_int - cov_int))
        echo ""
        echo -e "${RED}FAIL${NC}: Test coverage ${coverage}% < ${threshold}% threshold (${gap}% below)"
        exit 1
    fi
}

# ---- Rust Coverage ----------------------------------------------------------
check_rust() {
    if [ ! -f "$PROJECT_ROOT/Cargo.toml" ]; then
        return 1
    fi

    echo "Measuring test coverage for Rust project..."

    # Prefer cargo-tarpaulin
    if command -v cargo-tarpaulin &>/dev/null; then
        echo "  Using: cargo tarpaulin"
        local output
        output=$(cd "$PROJECT_ROOT" && cargo tarpaulin --skip-clean 2>&1) || true

        # Parse coverage percentage from tarpaulin output
        # Format: "XX.XX% coverage, N/M lines covered"
        local coverage
        coverage=$(echo "$output" | grep -oE '[0-9]+\.[0-9]+% coverage' | head -1 | grep -oE '[0-9]+\.[0-9]+')

        if [ -n "$coverage" ]; then
            check_result "$coverage" "$(get_threshold)"
        fi
    fi

    # Try cargo-llvm-cov
    if command -v cargo-llvm-cov &>/dev/null; then
        echo "  Using: cargo llvm-cov"
        local output
        output=$(cd "$PROJECT_ROOT" && cargo llvm-cov --summary-only 2>&1) || true

        local coverage
        coverage=$(echo "$output" | grep -oE 'TOTAL[[:space:]]+[0-9.]+%' | grep -oE '[0-9.]+' | head -1)

        if [ -n "$coverage" ]; then
            check_result "$coverage" "$(get_threshold)"
        fi
    fi

    echo -e "${YELLOW}WARN${NC}: No Rust coverage tool found. Install one:"
    echo "  cargo install cargo-tarpaulin"
    echo "  cargo install cargo-llvm-cov"
    exit 2
}

# ---- Node Coverage ----------------------------------------------------------
check_node() {
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        return 1
    fi

    echo "Measuring test coverage for Node.js project..."

    local coverage=""

    # Check for existing coverage summary (already run by CI or user)
    local cov_summary="$PROJECT_ROOT/coverage/coverage-summary.json"
    if [ -f "$cov_summary" ] && command -v jq &>/dev/null; then
        coverage=$(jq -r '.total.lines.pct // empty' "$cov_summary" 2>/dev/null)
        if [ -n "$coverage" ] && [ "$coverage" != "null" ]; then
            echo "  Using: existing coverage report"
            check_result "$coverage" "$(get_threshold)"
        fi
    fi

    # Try npx jest --coverage
    if grep -q '"jest"' "$PROJECT_ROOT/package.json" 2>/dev/null || \
       [ -f "$PROJECT_ROOT/jest.config.js" ] || [ -f "$PROJECT_ROOT/jest.config.ts" ]; then
        echo "  Using: jest --coverage"
        local output
        output=$(cd "$PROJECT_ROOT" && npx jest --coverage --coverageReporters=text-summary 2>&1) || true

        # Parse "Lines : XX.XX%" from jest output
        coverage=$(echo "$output" | grep -E "Lines\s*:" | grep -oE '[0-9]+\.?[0-9]*' | head -1)
        if [ -n "$coverage" ]; then
            check_result "$coverage" "$(get_threshold)"
        fi
    fi

    # Try npx vitest --coverage
    if grep -q '"vitest"' "$PROJECT_ROOT/package.json" 2>/dev/null || \
       [ -f "$PROJECT_ROOT/vitest.config.ts" ] || [ -f "$PROJECT_ROOT/vitest.config.js" ]; then
        echo "  Using: vitest --coverage"
        local output
        output=$(cd "$PROJECT_ROOT" && npx vitest run --coverage 2>&1) || true

        coverage=$(echo "$output" | grep -E "All files" | grep -oE '[0-9]+\.?[0-9]*' | head -1)
        if [ -n "$coverage" ]; then
            check_result "$coverage" "$(get_threshold)"
        fi
    fi

    echo -e "${YELLOW}WARN${NC}: Could not measure Node.js test coverage"
    echo "  Ensure jest or vitest is configured with coverage support"
    exit 2
}

# ---- Python Coverage --------------------------------------------------------
check_python() {
    local has_python=false
    for marker in setup.py pyproject.toml setup.cfg; do
        if [ -f "$PROJECT_ROOT/$marker" ]; then
            has_python=true
            break
        fi
    done

    if ! $has_python; then
        return 1
    fi

    echo "Measuring test coverage for Python project..."

    # Check for coverage.py
    if command -v coverage &>/dev/null || command -v python3 -m coverage &>/dev/null 2>&1; then
        echo "  Using: coverage.py"

        # Run tests with coverage if no existing report
        if [ ! -f "$PROJECT_ROOT/.coverage" ]; then
            (cd "$PROJECT_ROOT" && python3 -m coverage run -m pytest 2>&1) || true
        fi

        local output
        output=$(cd "$PROJECT_ROOT" && python3 -m coverage report 2>&1) || true

        # Parse "TOTAL ... XX%" from coverage report
        local coverage
        coverage=$(echo "$output" | grep -E "^TOTAL" | grep -oE '[0-9]+%' | grep -oE '[0-9]+')

        if [ -n "$coverage" ]; then
            check_result "$coverage" "$(get_threshold)"
        fi
    fi

    # Try pytest --cov directly
    if command -v pytest &>/dev/null; then
        echo "  Using: pytest --cov"
        local output
        output=$(cd "$PROJECT_ROOT" && python3 -m pytest --cov --cov-report=term-missing 2>&1) || true

        local coverage
        coverage=$(echo "$output" | grep -E "^TOTAL" | grep -oE '[0-9]+%' | grep -oE '[0-9]+')

        if [ -n "$coverage" ]; then
            check_result "$coverage" "$(get_threshold)"
        fi
    fi

    echo -e "${YELLOW}WARN${NC}: Could not measure Python test coverage"
    echo "  pip install coverage pytest-cov"
    exit 2
}

# ---- Main -------------------------------------------------------------------
echo "=== SPEAR Fitness: Test Coverage ==="
echo "Project: $PROJECT_ROOT"
echo ""

# Try each ecosystem
check_rust 2>/dev/null && exit $? || true
check_node 2>/dev/null && exit $? || true
check_python 2>/dev/null && exit $? || true

# Nothing detected
echo -e "${YELLOW}SKIP${NC}: No supported test framework detected"
echo "  Supported: cargo-tarpaulin, cargo-llvm-cov, jest, vitest, coverage.py"
exit 2
