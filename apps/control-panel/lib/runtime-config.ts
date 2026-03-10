const POSITIVE_INTEGER_REGEX = /^[1-9]\d*$/;
const TIME_RANGE_REGEX = /^\d+[smhd]$/i;

function getPositiveIntegerEnv(
  value: string | undefined,
  fallback: number
): number {
  if (!value || !POSITIVE_INTEGER_REGEX.test(value)) {
    return fallback;
  }

  return Number.parseInt(value, 10);
}

function getTimeRangeEnv(value: string | undefined, fallback: string): string {
  if (!value || !TIME_RANGE_REGEX.test(value)) {
    return fallback;
  }

  return value;
}

export const runtimeConfig = {
  dashboardUrl:
    process.env.NEXT_PUBLIC_K6_DASHBOARD_URL || "http://localhost:5665",
  statusPollIntervalMs: getPositiveIntegerEnv(
    process.env.NEXT_PUBLIC_K6_STATUS_POLL_INTERVAL_MS,
    1000
  ),
  metricsPollIntervalMs: getPositiveIntegerEnv(
    process.env.NEXT_PUBLIC_K6_METRICS_POLL_INTERVAL_MS,
    1000
  ),
  progressPollIntervalMs: getPositiveIntegerEnv(
    process.env.NEXT_PUBLIC_K6_PROGRESS_POLL_INTERVAL_MS,
    1000
  ),
  metricsTimeRange: getTimeRangeEnv(
    process.env.NEXT_PUBLIC_K6_METRICS_TIME_RANGE,
    "30s"
  ),
};

export function isValidTimeRange(value: string): boolean {
  return TIME_RANGE_REGEX.test(value);
}
