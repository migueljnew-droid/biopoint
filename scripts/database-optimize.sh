#!/bin/bash

# BioPoint Database Optimization Script
# Analyzes database performance and suggests optimizations
# HIPAA Performance Implication: Ensures system availability for patient care access

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SLOW_QUERY_THRESHOLD=500 # milliseconds
MIN_QUERY_COUNT=10       # minimum queries to consider for analysis
LOG_FILE="/tmp/biopoint-db-optimize-$(date +%Y%m%d-%H%M%S).log"

# Database connection
DB_URL="${DATABASE_URL:-}"
if [[ -z "$DB_URL" ]]; then
    echo -e "${RED}ERROR: DATABASE_URL environment variable is not set${NC}"
    exit 1
fi

# Logging function
log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

# Header
log "${BLUE}========================================${NC}"
log "${BLUE}BioPoint Database Optimization Analysis${NC}"
log "${BLUE}========================================${NC}"
log "Timestamp: $(date)"
log "Database: $(echo $DB_URL | sed 's/:[^@]*@/@/g')" # Mask password
log ""

# Check database connection
check_connection() {
    log "${YELLOW}Checking database connection...${NC}"
    if psql "$DB_URL" -c "SELECT 1;" >/dev/null 2>&1; then
        log "${GREEN}✓ Database connection successful${NC}"
    else
        log "${RED}✗ Database connection failed${NC}"
        exit 1
    fi
    log ""
}

# Analyze connection pool usage
analyze_connection_pool() {
    log "${YELLOW}Analyzing connection pool usage...${NC}"
    
    local query="
    SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections,
        count(*) FILTER (WHERE wait_event_type IS NOT NULL) as waiting_connections,
        avg(extract(epoch from (now() - state_change))) as avg_connection_age
    FROM pg_stat_activity 
    WHERE datname = current_database()
      AND pid != pg_backend_pid();"
    
    psql "$DB_URL" -c "$query" --pset=format=unaligned --pset=tuples_only=false 2>/dev/null || log "${RED}Failed to analyze connection pool${NC}"
    log ""
}

# Analyze slow queries
analyze_slow_queries() {
    log "${YELLOW}Analyzing slow queries (>${SLOW_QUERY_THRESHOLD}ms)...${NC}"
    
    local query="
    SELECT 
        query,
        calls,
        total_time,
        mean_time,
        max_time,
        rows,
        100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
    FROM pg_stat_statements
    WHERE mean_time > $SLOW_QUERY_THRESHOLD
      AND calls >= $MIN_QUERY_COUNT
    ORDER BY mean_time DESC
    LIMIT 10;"
    
    if psql "$DB_URL" -c "SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements';" | grep -q 1; then
        psql "$DB_URL" -c "$query" --pset=format=aligned --pset=tuples_only=false 2>/dev/null || log "${RED}Failed to analyze slow queries${NC}"
    else
        log "${YELLOW}pg_stat_statements extension not available${NC}"
        log "${BLUE}Run: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;${NC}"
    fi
    log ""
}

# Analyze table sizes and bloat
analyze_table_bloat() {
    log "${YELLOW}Analyzing table bloat...${NC}"
    
    local query="
    SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
        n_live_tup as row_count,
        ROUND(n_dead_tup::numeric / n_live_tup::numeric * 100, 2) as dead_tuple_ratio
    FROM pg_stat_user_tables
    WHERE n_live_tup > 1000
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    LIMIT 15;"
    
    psql "$DB_URL" -c "$query" --pset=format=aligned --pset=tuples_only=false 2>/dev/null || log "${RED}Failed to analyze table bloat${NC}"
    log ""
}

# Analyze index usage
analyze_index_usage() {
    log "${YELLOW}Analyzing index usage...${NC}"
    
    local query="
    SELECT 
        t.tablename,
        indexname,
        c.reltuples::BIGINT AS num_rows,
        pg_size_pretty(pg_relation_size(c.oid)) AS index_size,
        idx_scan as index_scans,
        seq_scan as table_scans,
        ROUND(idx_scan::numeric / nullif(seq_scan + idx_scan, 0) * 100, 2) as index_usage_ratio
    FROM pg_tables t
    LEFT JOIN pg_class c ON c.relname = t.tablename
    LEFT JOIN pg_stat_user_indexes ui ON ui.relname = t.tablename
    LEFT JOIN pg_stat_user_tables ut ON ut.relname = t.tablename
    WHERE t.schemaname = 'public'
      AND c.relkind = 'r'
      AND t.tablename NOT LIKE 'pg_%'
    ORDER BY idx_scan ASC
    LIMIT 15;"
    
    psql "$DB_URL" -c "$query" --pset=format=aligned --pset=tuples_only=false 2>/dev/null || log "${RED}Failed to analyze index usage${NC}"
    log ""
}

# Analyze missing indexes
analyze_missing_indexes() {
    log "${YELLOW}Analyzing potential missing indexes...${NC}"
    
    local query="
    SELECT 
        relname as table_name,
        seq_scan as table_scans,
        seq_tup_read as tuples_read,
        seq_tup_read / seq_scan as avg_tuples_per_scan,
        CASE 
            WHEN seq_scan > 1000 AND seq_tup_read / seq_scan > 1000 
            THEN 'Consider index on frequently scanned columns'
            ELSE 'OK'
        END as recommendation
    FROM pg_stat_user_tables
    WHERE seq_scan > 1000
    ORDER BY seq_tup_read DESC
    LIMIT 10;"
    
    psql "$DB_URL" -c "$query" --pset=format=aligned --pset=tuples_only=false 2>/dev/null || log "${RED}Failed to analyze missing indexes${NC}"
    log ""
}

# Analyze vacuum and analyze statistics
analyze_vacuum_stats() {
    log "${YELLOW}Analyzing vacuum and analyze statistics...${NC}"
    
    local query="
    SELECT 
        schemaname,
        tablename,
        last_vacuum,
        last_autovacuum,
        last_analyze,
        last_autoanalyze,
        n_dead_tup,
        CASE 
            WHEN n_dead_tup > 1000 THEN 'Needs vacuum'
            WHEN last_analyze < NOW() - INTERVAL '7 days' THEN 'Needs analyze'
            ELSE 'OK'
        END as status
    FROM pg_stat_user_tables
    WHERE n_dead_tup > 1000 OR last_analyze < NOW() - INTERVAL '7 days'
    ORDER BY n_dead_tup DESC
    LIMIT 10;"
    
    psql "$DB_URL" -c "$query" --pset=format=aligned --pset=tuples_only=false 2>/dev/null || log "${RED}Failed to analyze vacuum stats${NC}"
    log ""
}

# Generate connection pool recommendations
generate_pool_recommendations() {
    log "${YELLOW}Generating connection pool recommendations...${NC}"
    
    local current_connections=$(psql "$DB_URL" -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database();" 2>/dev/null | tr -d ' ')
    local max_connections=$(psql "$DB_URL" -t -c "SHOW max_connections;" 2>/dev/null | tr -d ' ')
    
    log "Current connections: $current_connections"
    log "Max connections: $max_connections"
    log ""
    
    # Connection pool sizing recommendations
    log "${BLUE}Connection Pool Sizing Recommendations:${NC}"
    log "• Development (5 connections): Suitable for 1-3 developers"
    log "• Staging (10 connections): Suitable for testing team"
    log "• Production (20 connections): Based on current usage analysis"
    log ""
    
    # Calculate recommended pool size based on CPU cores
    local cpu_cores=$(nproc 2>/dev/null || echo "4")
    local recommended_pool=$((cpu_cores * 2 + 2))
    
    log "${BLUE}System-based recommendation:${NC}"
    log "• CPU cores: $cpu_cores"
    log "• Recommended pool size: $recommended_pool connections"
    log "• Current production setting: 20 connections"
    log ""
    
    if [[ $current_connections -gt 15 ]]; then
        log "${YELLOW}WARNING: High connection usage detected${NC}"
        log "${BLUE}Consider:${NC}"
        log "• Increasing pool size to 25-30 connections"
        log "• Implementing connection pooling at application level"
        log "• Reviewing application connection patterns"
    fi
    log ""
}

# Generate optimization recommendations
generate_optimization_recommendations() {
    log "${YELLOW}Generating optimization recommendations...${NC}"
    
    log "${BLUE}Performance Optimization Recommendations:${NC}"
    log ""
    
    # Connection pool optimization
    log "1. Connection Pool Optimization:"
    log "   • Monitor pool utilization via /health/db endpoint"
    log "   • Set appropriate pool sizes per environment"
    log "   • Implement connection leak detection"
    log "   • Use connection pooling middleware"
    log ""
    
    # Query optimization
    log "2. Query Performance:"
    log "   • Enable pg_stat_statements extension"
    log "   • Monitor slow queries (>500ms)"
    log "   • Add indexes on frequently queried columns"
    log "   • Optimize JOIN operations"
    log ""
    
    # Index optimization
    log "3. Index Optimization:"
    log "   • Regular ANALYZE on frequently updated tables"
    log "   • Monitor index usage and remove unused indexes"
    log "   • Consider composite indexes for multi-column queries"
    log "   • Index foreign key columns"
    log ""
    
    # Maintenance
    log "4. Database Maintenance:"
    log "   • Regular VACUUM on high-update tables"
    log "   • Monitor table bloat and autovacuum settings"
    log "   • Update table statistics regularly"
    log "   • Monitor disk space and I/O performance"
    log ""
    
    # Monitoring
    log "5. Monitoring Setup:"
    log "   • Set up alerts for pool exhaustion (>90%)"
    log "   • Monitor connection wait times"
    log "   • Track query performance trends"
    log "   • Set up health check endpoints"
    log ""
}

# Generate Prisma schema recommendations
generate_prisma_recommendations() {
    log "${YELLOW}Generating Prisma schema recommendations...${NC}"
    
    log "${BLUE}Prisma Schema Optimizations:${NC}"
    log ""
    
    # Check for missing indexes
    local tables=$(psql "$DB_URL" -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'pg_%';" 2>/dev/null)
    
    for table in $tables; do
        local indexes=$(psql "$DB_URL" -t -c "SELECT count(*) FROM pg_indexes WHERE tablename = '$table';" 2>/dev/null | tr -d ' ')
        if [[ $indexes -lt 2 ]]; then
            log "• Table $table has only $indexes indexes - consider adding indexes"
        fi
    done
    log ""
    
    # Foreign key recommendations
    log "• Ensure foreign key columns are indexed for better JOIN performance"
    log "• Consider adding @@index directives in Prisma schema for frequently queried fields"
    log "• Use @unique constraints where appropriate to enforce data integrity"
    log ""
}

# Main execution
main() {
    check_connection
    analyze_connection_pool
    analyze_slow_queries
    analyze_table_bloat
    analyze_index_usage
    analyze_missing_indexes
    analyze_vacuum_stats
    generate_pool_recommendations
    generate_optimization_recommendations
    generate_prisma_recommendations
    
    log "${GREEN}========================================${NC}"
    log "${GREEN}Analysis complete! Check log file:${NC}"
    log "${BLUE}$LOG_FILE${NC}"
    log "${GREEN}========================================${NC}"
}

# Run main function
main "$@"