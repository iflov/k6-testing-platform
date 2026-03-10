import { Prisma, test_status } from "@prisma/client";

import {
  createEmptyK6Metrics,
  fetchK6Metrics,
  hasRecordedK6Metrics,
  type K6Metrics,
} from "@/lib/k6-metrics";
import { prisma } from "@/src/lib/prisma";

const METRIC_RETRY_DELAY_MS = 1500;
const METRIC_RETRY_COUNT = 4;

interface PersistTestRunCompletionInput {
  testId: string;
  status?: test_status;
  metrics?: K6Metrics | null;
  completedAt?: Date;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildTimeRange(startedAt: Date, completedAt: Date): string {
  const elapsedSeconds = Math.ceil(
    (completedAt.getTime() - startedAt.getTime()) / 1000
  );
  const safeSeconds = Math.max(300, elapsedSeconds + 120);
  return `${safeSeconds}s`;
}

async function loadMetricsWithRetry(
  testId: string,
  timeRange: string
): Promise<K6Metrics> {
  let lastMetrics = createEmptyK6Metrics();

  for (let attempt = 1; attempt <= METRIC_RETRY_COUNT; attempt += 1) {
    try {
      const metrics = await fetchK6Metrics(timeRange, testId);
      lastMetrics = metrics;

      if (hasRecordedK6Metrics(metrics) || attempt === METRIC_RETRY_COUNT) {
        return metrics;
      }
    } catch (error) {
      if (attempt === METRIC_RETRY_COUNT) {
        throw error;
      }
    }

    await sleep(METRIC_RETRY_DELAY_MS);
  }

  return lastMetrics;
}

function buildTestResultData(metrics: K6Metrics) {
  const totalRequests = metrics.http_reqs?.count || 0;
  const errorRate = metrics.http_req_failed?.rate || 0;
  const failedRequests = Math.round(totalRequests * errorRate);
  const metricsJson = JSON.parse(
    JSON.stringify(metrics)
  ) as Prisma.InputJsonValue;

  return {
    totalRequests,
    failedRequests,
    avgResponseTime: metrics.http_req_duration?.avg || 0,
    minResponseTime: metrics.http_req_duration?.min || 0,
    maxResponseTime: metrics.http_req_duration?.max || 0,
    p95ResponseTime: metrics.http_req_duration?.p95 || 0,
    p99ResponseTime: metrics.http_req_duration?.p99 || 0,
    avgRequestRate: metrics.http_reqs?.rate || 0,
    errorRate,
    dataReceived: BigInt(Math.floor(metrics.data_received || 0)),
    dataSent: BigInt(Math.floor(metrics.data_sent || 0)),
    maxVus: metrics.vus_max || metrics.vus || 0,
    avgIterationDuration: metrics.iteration_duration?.avg || null,
    metricsJson,
  };
}

export async function persistTestRunCompletion({
  testId,
  status = test_status.completed,
  metrics = null,
  completedAt = new Date(),
}: PersistTestRunCompletionInput) {
  const testRun = await prisma.testRun.findUnique({
    where: { testId },
  });

  if (!testRun) {
    return null;
  }

  const updatedTestRun = await prisma.testRun.update({
    where: { id: testRun.id },
    data: {
      status,
      completedAt,
    },
  });

  if (status === test_status.cancelled) {
    return {
      testRun: updatedTestRun,
      testResult: null,
      metricsSaved: false,
    };
  }

  let resolvedMetrics = metrics;

  if (!resolvedMetrics) {
    try {
      resolvedMetrics = await loadMetricsWithRetry(
        testId,
        buildTimeRange(testRun.startedAt, completedAt)
      );
    } catch (error) {
      console.error("Failed to fetch metrics for completed test:", {
        testId,
        status,
        error,
      });

      return {
        testRun: updatedTestRun,
        testResult: null,
        metricsSaved: false,
      };
    }
  }

  const testResult = await prisma.testResult.upsert({
    where: { testRunId: testRun.id },
    create: {
      testRunId: testRun.id,
      ...buildTestResultData(resolvedMetrics),
    },
    update: buildTestResultData(resolvedMetrics),
  });

  return {
    testRun: updatedTestRun,
    testResult,
    metricsSaved: true,
  };
}
