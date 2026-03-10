import config from "@/lib/config";

export interface K6Metrics {
  timestamp: string;
  http_req_duration: {
    avg: number;
    min: number;
    max: number;
    p95: number | null;
    p99: number | null;
  };
  http_reqs: {
    count: number;
    rate: number;
  };
  vus: number;
  vus_max: number;
  http_req_failed: {
    count: number;
    rate: number;
  };
  iteration_duration: {
    avg: number;
    min: number;
    max: number;
  };
  data_received: number;
  data_sent: number;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidTestId(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function createEmptyK6Metrics(): K6Metrics {
  return {
    timestamp: new Date().toISOString(),
    http_req_duration: {
      avg: 0,
      min: 0,
      max: 0,
      p95: null,
      p99: null,
    },
    http_reqs: {
      count: 0,
      rate: 0,
    },
    vus: 0,
    vus_max: 0,
    http_req_failed: {
      count: 0,
      rate: 0,
    },
    iteration_duration: {
      avg: 0,
      min: 0,
      max: 0,
    },
    data_received: 0,
    data_sent: 0,
  };
}

export function hasRecordedK6Metrics(metrics: K6Metrics): boolean {
  return (
    metrics.http_reqs.count > 0 ||
    metrics.data_received > 0 ||
    metrics.data_sent > 0 ||
    metrics.vus_max > 0
  );
}

export async function fetchK6Metrics(
  timeRange: string,
  testId: string | null
): Promise<K6Metrics> {
  const [
    httpReqDuration,
    httpReqs,
    vus,
    httpReqFailed,
    iterationDuration,
    dataTransfer,
  ] = await Promise.all([
    queryInfluxDb3HttpReqDuration(timeRange, testId),
    queryInfluxDb3HttpReqs(timeRange, testId),
    queryInfluxDb3VUs(timeRange, testId),
    queryInfluxDb3HttpReqFailed(timeRange, testId),
    queryInfluxDb3IterationDuration(timeRange, testId),
    queryInfluxDb3DataTransfer(timeRange, testId),
  ]);

  return {
    timestamp: new Date().toISOString(),
    http_req_duration: httpReqDuration,
    http_reqs: httpReqs,
    vus: vus.current,
    vus_max: vus.max,
    http_req_failed: httpReqFailed,
    iteration_duration: iterationDuration,
    data_received: dataTransfer.received,
    data_sent: dataTransfer.sent,
  };
}

async function queryInfluxDb3(query: string) {
  const influxConfig = config.getInfluxDbConfig();
  const url = `${influxConfig.url}/api/v3/query_sql`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${influxConfig.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      db: influxConfig.bucket,
      q: query,
    }),
  });

  if (!response.ok) {
    throw new Error(`InfluxDB 3.x query failed: ${response.statusText}`);
  }

  return response.json();
}

async function queryInfluxDb3HttpReqDuration(
  timeRange: string,
  testId: string | null
) {
  const testIdFilter = testId ? `AND "testId" = '${testId}'` : "";
  const query = `
    SELECT
      AVG(value) as avg,
      MIN(value) as min,
      MAX(value) as max
    FROM http_req_duration
    WHERE time > now() - INTERVAL '${timeRange}' ${testIdFilter}
  `;

  const result = await queryInfluxDb3(query);

  if (result?.[0]) {
    return {
      avg: parseFloat(result[0].avg) || 0,
      min: parseFloat(result[0].min) || 0,
      max: parseFloat(result[0].max) || 0,
      p95: null,
      p99: null,
    };
  }

  return createEmptyK6Metrics().http_req_duration;
}

async function queryInfluxDb3HttpReqs(timeRange: string, testId: string | null) {
  const testIdFilter = testId ? `AND "testId" = '${testId}'` : "";
  const query = `
    SELECT
      COUNT(value) as count,
      AVG(value) as rate
    FROM http_reqs
    WHERE time > now() - INTERVAL '${timeRange}' ${testIdFilter}
  `;

  const result = await queryInfluxDb3(query);

  if (result?.[0]) {
    return {
      count: Math.floor(parseFloat(result[0].count) || 0),
      rate: parseFloat(result[0].rate) || 0,
    };
  }

  return createEmptyK6Metrics().http_reqs;
}

async function queryInfluxDb3VUs(timeRange: string, testId: string | null) {
  const testIdFilter = testId ? `AND "testId" = '${testId}'` : "";

  const currentQuery = `
    SELECT value as current
    FROM vus
    WHERE time > now() - INTERVAL '${timeRange}' ${testIdFilter}
    ORDER BY time DESC
    LIMIT 1
  `;

  const maxQuery = `
    SELECT MAX(value) as max
    FROM vus
    WHERE time > now() - INTERVAL '${timeRange}' ${testIdFilter}
  `;

  const [currentResult, maxResult] = await Promise.all([
    queryInfluxDb3(currentQuery),
    queryInfluxDb3(maxQuery),
  ]);

  return {
    current: currentResult?.[0]?.current
      ? Math.floor(parseFloat(currentResult[0].current))
      : 0,
    max: maxResult?.[0]?.max ? Math.floor(parseFloat(maxResult[0].max)) : 0,
  };
}

async function queryInfluxDb3HttpReqFailed(
  timeRange: string,
  testId: string | null
) {
  const testIdFilter = testId ? `AND "testId" = '${testId}'` : "";
  const query = `
    SELECT
      COUNT(value) as count,
      AVG(value) as rate
    FROM http_req_failed
    WHERE time > now() - INTERVAL '${timeRange}' ${testIdFilter}
  `;

  const result = await queryInfluxDb3(query);

  if (result?.[0]) {
    return {
      count: Math.floor(parseFloat(result[0].count) || 0),
      rate: parseFloat(result[0].rate) || 0,
    };
  }

  return createEmptyK6Metrics().http_req_failed;
}

async function queryInfluxDb3IterationDuration(
  timeRange: string,
  testId: string | null
) {
  const testIdFilter = testId ? `AND "testId" = '${testId}'` : "";
  const query = `
    SELECT
      AVG(value) as avg,
      MIN(value) as min,
      MAX(value) as max
    FROM iteration_duration
    WHERE time > now() - INTERVAL '${timeRange}' ${testIdFilter}
  `;

  const result = await queryInfluxDb3(query);

  if (result?.[0]) {
    return {
      avg: parseFloat(result[0].avg) || 0,
      min: parseFloat(result[0].min) || 0,
      max: parseFloat(result[0].max) || 0,
    };
  }

  return createEmptyK6Metrics().iteration_duration;
}

async function queryInfluxDb3DataTransfer(
  timeRange: string,
  testId: string | null
) {
  const testIdFilter = testId ? `AND "testId" = '${testId}'` : "";

  const querySent = `
    SELECT SUM(value) as total
    FROM data_sent
    WHERE time > now() - INTERVAL '${timeRange}' ${testIdFilter}
  `;

  const queryReceived = `
    SELECT SUM(value) as total
    FROM data_received
    WHERE time > now() - INTERVAL '${timeRange}' ${testIdFilter}
  `;

  const [sentResult, receivedResult] = await Promise.all([
    queryInfluxDb3(querySent),
    queryInfluxDb3(queryReceived),
  ]);

  return {
    sent: sentResult?.[0]?.total ? Math.floor(parseFloat(sentResult[0].total)) : 0,
    received: receivedResult?.[0]?.total
      ? Math.floor(parseFloat(receivedResult[0].total))
      : 0,
  };
}
