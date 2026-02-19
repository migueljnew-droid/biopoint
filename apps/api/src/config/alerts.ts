/**
 * Datadog monitor definitions for production alerting (MON-03).
 *
 * These JSON objects define the monitors to create via the Datadog API
 * or Terraform. They are co-located with the monitoring config so thresholds
 * stay in sync with ALERT_THRESHOLDS.
 *
 * To apply: POST each definition to https://api.datadoghq.com/api/v1/monitor
 * with a DATADOG_API_KEY and DATADOG_APP_KEY.
 *
 * Reference: https://docs.datadoghq.com/api/latest/monitors/
 */

export const DATADOG_MONITORS = [
  {
    name: 'BioPoint API — High Error Rate',
    type: 'metric alert',
    query: 'sum(last_5m):sum:trace.fastify.request.errors{env:production,service:biopoint-api}.as_rate() / sum:trace.fastify.request.hits{env:production,service:biopoint-api}.as_rate() * 100 > 1',
    message: '@pagerduty-biopoint Error rate exceeded 1% in the last 5 minutes. Check Datadog APM traces.',
    tags: ['service:biopoint-api', 'env:production', 'team:backend'],
    options: {
      thresholds: { critical: 1.0, warning: 0.5 },
      notify_no_data: false,
      require_full_window: false,
      evaluation_delay: 60,
    },
  },
  {
    name: 'BioPoint API — High Response Time (p95)',
    type: 'metric alert',
    query: 'avg(last_5m):p95:trace.fastify.request.duration{env:production,service:biopoint-api} > 2000',
    message: '@pagerduty-biopoint p95 response time exceeded 2000ms. Check for slow DB queries or high load.',
    tags: ['service:biopoint-api', 'env:production', 'team:backend'],
    options: {
      thresholds: { critical: 2000, warning: 1000 },
      notify_no_data: false,
      require_full_window: false,
      evaluation_delay: 60,
    },
  },
  {
    name: 'BioPoint API — DB Connection Pool Saturation',
    type: 'metric alert',
    // Prisma emits prisma_pool_connections_open and prisma_pool_connections_idle via OpenTelemetry
    query: 'avg(last_5m):sum:prisma.pool.connections.open{env:production,service:biopoint-api} / (sum:prisma.pool.connections.open{env:production,service:biopoint-api} + sum:prisma.pool.connections.idle{env:production,service:biopoint-api}) * 100 > 80',
    message: '@pagerduty-biopoint DB connection pool is above 80% utilization. Risk of connection exhaustion.',
    tags: ['service:biopoint-api', 'env:production', 'team:backend'],
    options: {
      thresholds: { critical: 80, warning: 60 },
      notify_no_data: false,
      require_full_window: false,
      evaluation_delay: 60,
    },
  },
] as const;

/**
 * Sentry alert rules for production (configured via Sentry dashboard or sentry-cli).
 * These document the alert rules that must be created in the Sentry project.
 */
export const SENTRY_ALERT_RULES = [
  {
    name: 'BioPoint — Error Spike',
    // Alert when error count exceeds 10 in a 5-minute window
    conditions: [{ id: 'sentry.rules.conditions.event_frequency.EventFrequencyCondition', value: 10, interval: '5m' }],
    actions: [{ id: 'sentry.mail.actions.NotifyEmailAction', targetType: 'Team' }],
  },
] as const;
