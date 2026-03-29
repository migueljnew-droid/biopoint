#!/usr/bin/env bash
# ============================================================================
# SPEAR Fitness Function: API Response Time
# ============================================================================
# Measures API endpoint response time and compares against the ratchet ceiling.
#
# Sends an HTTP request to a configurable endpoint and measures the total
# time in milliseconds. Supports multiple samples for more reliable results.
#
# Environment variables:
#   SPEAR_API_URL       Target URL to test (REQUIRED)
#   SPEAR_API_METHOD    HTTP method (default: GET)
#   SPEAR_API_SAMPLES   Number of requests to average (default: 3)
#   SPEAR_API_TIMEOUT   Request timeout in seconds (default: 30)
#   SPEAR_API_HEADERS   Extra headers, comma-separated (e.g., "Authorization: Bearer x,Accept: application/json")
#   SPEAR_API_BODY      Request body for POST/PUT (optional)
#
# Reads threshold from: .spear/ratchet/ratchet.json (not present by default;
#   uses max_build_time as fallback concept, but truly expects a custom
#   "api_response_time" threshold if configured)
# Default threshold: 2000 ms (2 seconds)
#
# Exit codes:
#   0 = PASS (response time <= threshold)
#   1 = FAIL (response time > threshold)
#   2 = SKIP (SPEAR_API_URL not set or endpoint unreachable)
# ============================================================================

set -euo pipefail

SPEAR_DIR="${SPEAR_DIR:-.spear}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
RATCHET_FILE="$PROJECT_ROOT/$SPEAR_DIR/ratchet/ratchet.json"

# Configuration
API_URL="${SPEAR_API_URL:-}"
API_METHOD="${SPEAR_API_METHOD:-GET}"
API_SAMPLES="${SPEAR_API_SAMPLES:-3}"
API_TIMEOUT="${SPEAR_API_TIMEOUT:-30}"
API_HEADERS="${SPEAR_API_HEADERS:-}"
API_BODY="${SPEAR_API_BODY:-}"

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
    # Default: 2000ms (2 seconds)
    local default_threshold=2000

    if [ ! -f "$RATCHET_FILE" ]; then
        echo "$default_threshold"
        return
    fi

    if command -v jq &>/dev/null; then
        # Look for a custom api_response_time threshold first
        local val
        val=$(jq -r '.thresholds.api_response_time.value // empty' "$RATCHET_FILE" 2>/dev/null)
        if [ -n "$val" ] && [ "$val" != "null" ]; then
            echo "$val"
            return
        fi
    fi

    echo "$default_threshold"
}

# ---- Measure single request -------------------------------------------------
measure_request() {
    local curl_args=(-s -o /dev/null -w "%{time_total}" --max-time "$API_TIMEOUT")

    # Method
    curl_args+=(-X "$API_METHOD")

    # Headers
    if [ -n "$API_HEADERS" ]; then
        IFS=',' read -ra header_array <<< "$API_HEADERS"
        for header in "${header_array[@]}"; do
            curl_args+=(-H "$(echo "$header" | xargs)")  # trim whitespace
        done
    fi

    # Body
    if [ -n "$API_BODY" ]; then
        curl_args+=(-d "$API_BODY")
        # Add content-type if not already specified
        if ! echo "$API_HEADERS" | grep -qi "content-type"; then
            curl_args+=(-H "Content-Type: application/json")
        fi
    fi

    curl_args+=("$API_URL")

    # curl returns time_total in seconds (e.g., 0.123456)
    local time_sec
    time_sec=$(curl "${curl_args[@]}" 2>/dev/null) || echo "-1"
    echo "$time_sec"
}

# ---- Main -------------------------------------------------------------------
echo "=== SPEAR Fitness: API Response Time ==="
echo "Project: $PROJECT_ROOT"
echo ""

# Check prerequisites
if [ -z "$API_URL" ]; then
    echo -e "${YELLOW}SKIP${NC}: SPEAR_API_URL environment variable not set"
    echo ""
    echo "  Usage:"
    echo "    export SPEAR_API_URL=http://localhost:3000/api/health"
    echo "    .spear/fitness/examples/api-response-time.sh"
    echo ""
    echo "  Optional variables:"
    echo "    SPEAR_API_METHOD=GET          HTTP method"
    echo "    SPEAR_API_SAMPLES=3           Number of samples to average"
    echo "    SPEAR_API_TIMEOUT=30          Timeout per request (seconds)"
    echo "    SPEAR_API_HEADERS='K: V,...'  Extra headers"
    echo "    SPEAR_API_BODY='{...}'        Request body for POST/PUT"
    exit 2
fi

if ! command -v curl &>/dev/null; then
    echo -e "${RED}FAIL${NC}: curl is required but not installed"
    exit 2
fi

# Display configuration
echo "  URL:      $API_URL"
echo "  Method:   $API_METHOD"
echo "  Samples:  $API_SAMPLES"
echo "  Timeout:  ${API_TIMEOUT}s"
[ -n "$API_HEADERS" ] && echo "  Headers:  $API_HEADERS"
[ -n "$API_BODY" ] && echo "  Body:     ${API_BODY:0:80}..."
echo ""

# Warm-up request (not counted)
echo "  Warm-up request..."
warmup=$(measure_request)
if [ "$warmup" = "-1" ]; then
    echo -e "${YELLOW}SKIP${NC}: Could not reach $API_URL"
    echo "  Ensure the API is running and accessible"
    exit 2
fi

# Measure samples
total_ms=0
min_ms=999999
max_ms=0
failures=0

echo "  Measuring $API_SAMPLES samples..."
for i in $(seq 1 "$API_SAMPLES"); do
    time_sec=$(measure_request)

    if [ "$time_sec" = "-1" ]; then
        echo "    Sample $i: FAILED (timeout or connection error)"
        failures=$((failures + 1))
        continue
    fi

    # Convert seconds to milliseconds (integer)
    time_ms=$(echo "$time_sec" | awk '{printf "%d", $1 * 1000}')
    total_ms=$((total_ms + time_ms))

    if [ "$time_ms" -lt "$min_ms" ]; then min_ms=$time_ms; fi
    if [ "$time_ms" -gt "$max_ms" ]; then max_ms=$time_ms; fi

    echo "    Sample $i: ${time_ms}ms"
done

# Check if we got enough successful samples
successful=$((API_SAMPLES - failures))
if [ "$successful" -eq 0 ]; then
    echo ""
    echo -e "${RED}FAIL${NC}: All $API_SAMPLES requests failed"
    exit 1
fi

# Calculate average
avg_ms=$((total_ms / successful))

echo ""
echo "  Results ($successful/$API_SAMPLES successful):"
echo -e "    Average: ${CYAN}${avg_ms}ms${NC}"
echo -e "    Min:     ${min_ms}ms"
echo -e "    Max:     ${max_ms}ms"
[ "$failures" -gt 0 ] && echo -e "    Failed:  ${RED}${failures}${NC}"

# Compare to threshold
threshold=$(get_threshold)
echo ""
echo -e "  Threshold: ${CYAN}${threshold}ms${NC} (ceiling)"

if [ "$avg_ms" -le "$threshold" ]; then
    local_headroom=$((threshold - avg_ms))
    echo ""
    echo -e "${GREEN}PASS${NC}: Average response time ${avg_ms}ms <= ${threshold}ms threshold (${local_headroom}ms headroom)"
    exit 0
else
    local_overage=$((avg_ms - threshold))
    echo ""
    echo -e "${RED}FAIL${NC}: Average response time ${avg_ms}ms > ${threshold}ms threshold (${local_overage}ms over)"
    exit 1
fi
