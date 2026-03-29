#!/usr/bin/env bash
# ============================================================================
# SPEAR Fitness Function: Bundle Size
# ============================================================================
# Measures the output bundle/binary size and compares against the ratchet
# ceiling threshold.
#
# Supported ecosystems:
#   - Rust:   Measures binary size in target/release/ or target/debug/
#   - Node:   Measures dist/ or build/ folder total size
#   - Generic: Measures a configurable output directory
#
# Reads threshold from: .spear/ratchet/ratchet.json -> thresholds.max_bundle_size.value
# Default threshold: 500 KB
#
# Environment variables:
#   SPEAR_BUNDLE_DIR   Override the directory to measure (relative to project root)
#   SPEAR_BUNDLE_BIN   Specific binary to measure (for Rust projects)
#
# Exit codes:
#   0 = PASS (size <= threshold)
#   1 = FAIL (size > threshold)
#   2 = SKIP (no output to measure)
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
    local default_threshold=500

    if [ ! -f "$RATCHET_FILE" ]; then
        echo "$default_threshold"
        return
    fi

    if command -v jq &>/dev/null; then
        local val
        val=$(jq -r '.thresholds.max_bundle_size.value // empty' "$RATCHET_FILE" 2>/dev/null)
        if [ -n "$val" ] && [ "$val" != "null" ]; then
            echo "$val"
            return
        fi
    else
        local val
        val=$(grep -A2 '"max_bundle_size"' "$RATCHET_FILE" 2>/dev/null | \
              grep '"value"' | sed 's/.*: *\([0-9]*\).*/\1/' || true)
        if [ -n "$val" ]; then
            echo "$val"
            return
        fi
    fi

    echo "$default_threshold"
}

# ---- Measure directory size in KB ------------------------------------------
measure_dir_kb() {
    local dir="$1"
    if [ ! -d "$dir" ]; then
        echo "0"
        return
    fi
    # du -sk gives size in KB blocks
    du -sk "$dir" 2>/dev/null | awk '{print $1}'
}

# ---- Measure file size in KB -----------------------------------------------
measure_file_kb() {
    local file="$1"
    if [ ! -f "$file" ]; then
        echo "0"
        return
    fi
    local bytes
    bytes=$(wc -c < "$file" 2>/dev/null)
    echo $(( (bytes + 1023) / 1024 ))
}

# ---- Compare size to ceiling threshold --------------------------------------
check_result() {
    local size_kb="$1"
    local threshold_kb="$2"
    local label="$3"

    echo ""
    echo -e "  Measured:  ${CYAN}${size_kb} KB${NC} ($label)"
    echo -e "  Threshold: ${CYAN}${threshold_kb} KB${NC} (ceiling)"

    if [ "$size_kb" -le "$threshold_kb" ]; then
        local headroom=$((threshold_kb - size_kb))
        echo ""
        echo -e "${GREEN}PASS${NC}: Bundle size ${size_kb} KB <= ${threshold_kb} KB threshold (${headroom} KB headroom)"
        exit 0
    else
        local overage=$((size_kb - threshold_kb))
        echo ""
        echo -e "${RED}FAIL${NC}: Bundle size ${size_kb} KB > ${threshold_kb} KB threshold (${overage} KB over)"
        exit 1
    fi
}

# ---- Rust Binary Size -------------------------------------------------------
check_rust() {
    if [ ! -f "$PROJECT_ROOT/Cargo.toml" ]; then
        return 1
    fi

    echo "Measuring binary size for Rust project..."

    # If a specific binary is requested
    if [ -n "${SPEAR_BUNDLE_BIN:-}" ]; then
        local bin_path="$PROJECT_ROOT/$SPEAR_BUNDLE_BIN"
        if [ -f "$bin_path" ]; then
            local size_kb
            size_kb=$(measure_file_kb "$bin_path")
            check_result "$size_kb" "$(get_threshold)" "$SPEAR_BUNDLE_BIN"
        fi
    fi

    # Check release build first, then debug
    local target_dir="$PROJECT_ROOT/target"
    for profile in release debug; do
        local profile_dir="$target_dir/$profile"
        if [ ! -d "$profile_dir" ]; then
            continue
        fi

        # Find the largest executable in the profile directory (likely the main binary)
        local largest_bin=""
        local largest_size=0

        while IFS= read -r bin; do
            if [ -x "$bin" ] && file "$bin" 2>/dev/null | grep -q "executable"; then
                local size
                size=$(wc -c < "$bin" 2>/dev/null || echo 0)
                if [ "$size" -gt "$largest_size" ]; then
                    largest_size=$size
                    largest_bin=$bin
                fi
            fi
        done < <(find "$profile_dir" -maxdepth 1 -type f 2>/dev/null)

        if [ -n "$largest_bin" ]; then
            local size_kb=$(( (largest_size + 1023) / 1024 ))
            local bin_name
            bin_name=$(basename "$largest_bin")
            echo "  Found: $bin_name ($profile build)"
            check_result "$size_kb" "$(get_threshold)" "$bin_name ($profile)"
        fi
    done

    echo -e "${YELLOW}WARN${NC}: No Rust binary found. Run 'cargo build --release' first."
    exit 2
}

# ---- Node Bundle Size -------------------------------------------------------
check_node() {
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        return 1
    fi

    echo "Measuring bundle size for Node.js project..."

    # Check common output directories
    for dir_name in dist build out .next/static public/build; do
        local dir_path="$PROJECT_ROOT/$dir_name"
        if [ -d "$dir_path" ]; then
            local size_kb
            size_kb=$(measure_dir_kb "$dir_path")
            if [ "$size_kb" -gt 0 ]; then
                echo "  Found: $dir_name/"
                check_result "$size_kb" "$(get_threshold)" "$dir_name/"
            fi
        fi
    done

    echo -e "${YELLOW}WARN${NC}: No build output found. Run your build command first."
    echo "  Checked: dist/, build/, out/, .next/static/, public/build/"
    exit 2
}

# ---- Custom Directory -------------------------------------------------------
check_custom() {
    if [ -z "${SPEAR_BUNDLE_DIR:-}" ]; then
        return 1
    fi

    local dir_path="$PROJECT_ROOT/$SPEAR_BUNDLE_DIR"
    echo "Measuring custom bundle directory: $SPEAR_BUNDLE_DIR"

    if [ -d "$dir_path" ]; then
        local size_kb
        size_kb=$(measure_dir_kb "$dir_path")
        check_result "$size_kb" "$(get_threshold)" "$SPEAR_BUNDLE_DIR/"
    elif [ -f "$dir_path" ]; then
        local size_kb
        size_kb=$(measure_file_kb "$dir_path")
        check_result "$size_kb" "$(get_threshold)" "$SPEAR_BUNDLE_DIR"
    else
        echo -e "${RED}FAIL${NC}: Custom bundle path not found: $SPEAR_BUNDLE_DIR"
        exit 1
    fi
}

# ---- Validate environment inputs against path traversal --------------------
case "${SPEAR_BUNDLE_DIR:-}" in
    *..*) echo -e "${RED}FAIL${NC}: SPEAR_BUNDLE_DIR contains path traversal"; exit 1 ;;
esac
case "${SPEAR_BUNDLE_BIN:-}" in
    *..*) echo -e "${RED}FAIL${NC}: SPEAR_BUNDLE_BIN contains path traversal"; exit 1 ;;
esac

# ---- Main -------------------------------------------------------------------
echo "=== SPEAR Fitness: Bundle Size ==="
echo "Project: $PROJECT_ROOT"
echo ""

# Custom directory takes priority
check_custom 2>/dev/null && exit $? || true

# Auto-detect ecosystem
check_rust 2>/dev/null && exit $? || true
check_node 2>/dev/null && exit $? || true

# Nothing found
echo -e "${YELLOW}SKIP${NC}: No build output found to measure"
echo "  Set SPEAR_BUNDLE_DIR to specify the output directory"
echo "  Or run your build command first"
exit 2
