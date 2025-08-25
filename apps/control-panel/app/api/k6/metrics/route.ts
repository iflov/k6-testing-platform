import { NextRequest, NextResponse } from "next/server";
import config from "@/lib/config";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testId = searchParams.get("testId");
  const realtime = searchParams.get("realtime") === "true";

  // 실제 InfluxDB 3.x에서 메트릭 조회
  try {
    // 시간 범위 설정 (실시간 모드일 경우 10초, 아니면 5분)
    const timeRange = realtime ? "10s" : "5m";

    // InfluxDB 3.x (SQL 쿼리 사용)
    return await queryInfluxDb3Metrics(timeRange, testId);
  } catch (error) {
    console.error("Failed to fetch metrics from InfluxDB:", error);
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}

// InfluxDB 3.x 메트릭 조회
async function queryInfluxDb3Metrics(timeRange: string, testId: string | null) {
  // InfluxDB 3.x uses SQL queries with the /api/v2/query endpoint
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

  const metrics = {
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

  return NextResponse.json(metrics);
}

// InfluxDB 3.x SQL 쿼리 헬퍼 함수
async function queryInfluxDb3(query: string) {
  const influxConfig = config.getInfluxDbConfig();
  // InfluxDB 3.x Core uses /api/v3/query_sql endpoint
  const url = `${influxConfig.url}/api/v3/query_sql`;

  const headers: HeadersInit = {
    Authorization: `Token ${influxConfig.token}`,
    "Content-Type": "application/json",
  };

  // InfluxDB 3.x expects both db and q fields in JSON body
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      db: influxConfig.bucket,
      q: query,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("InfluxDB 3.x query failed:", response.statusText);
    console.error("Error details:", errorText);
    console.error("Query was:", query);
    throw new Error(`InfluxDB 3.x query failed: ${response.statusText}`);
  }

  // Parse JSON response
  const result = await response.json();
  return result;
}

// InfluxDB 3.x 메트릭 쿼리 함수들
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

  if (result && result[0]) {
    return {
      avg: parseFloat(result[0].avg) || 0,
      min: parseFloat(result[0].min) || 0,
      max: parseFloat(result[0].max) || 0,
      p95: 0, // Not supported in InfluxDB 3.x SQL
      p99: 0, // Not supported in InfluxDB 3.x SQL
    };
  }

  return { avg: 0, min: 0, max: 0, p95: 0, p99: 0 };
}

async function queryInfluxDb3HttpReqs(
  timeRange: string,
  testId: string | null
) {
  const testIdFilter = testId ? `AND "testId" = '${testId}'` : "";

  const query = `
    SELECT 
      COUNT(value) as count,
      AVG(value) as rate
    FROM http_reqs
    WHERE time > now() - INTERVAL '${timeRange}' ${testIdFilter}
  `;

  const result = await queryInfluxDb3(query);

  if (result && result[0]) {
    return {
      count: Math.floor(parseFloat(result[0].count) || 0),
      rate: parseFloat(result[0].rate) || 0,
    };
  }

  return { count: 0, rate: 0 };
}

async function queryInfluxDb3VUs(timeRange: string, testId: string | null) {
  const testIdFilter = testId ? `AND "testId" = '${testId}'` : "";

  // Get current value with separate query
  const currentQuery = `
    SELECT value as current
    FROM vus
    WHERE time > now() - INTERVAL '${timeRange}' ${testIdFilter}
    ORDER BY time DESC
    LIMIT 1
  `;

  // Get max value with separate query
  const maxQuery = `
    SELECT MAX(value) as max
    FROM vus
    WHERE time > now() - INTERVAL '${timeRange}' ${testIdFilter}
  `;

  const [currentResult, maxResult] = await Promise.all([
    queryInfluxDb3(currentQuery),
    queryInfluxDb3(maxQuery),
  ]);

  const current = currentResult?.[0]?.current
    ? Math.floor(parseFloat(currentResult[0].current))
    : 0;
  const max = maxResult?.[0]?.max
    ? Math.floor(parseFloat(maxResult[0].max))
    : 0;

  return { current, max };
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

  if (result && result[0]) {
    return {
      count: Math.floor(parseFloat(result[0].count) || 0),
      rate: parseFloat(result[0].rate) || 0,
    };
  }

  return { count: 0, rate: 0 };
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

  if (result && result[0]) {
    return {
      avg: parseFloat(result[0].avg) || 0,
      min: parseFloat(result[0].min) || 0,
      max: parseFloat(result[0].max) || 0,
    };
  }

  return { avg: 0, min: 0, max: 0 };
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

  const sent = sentResult?.[0]?.total ? parseFloat(sentResult[0].total) : 0;
  const received = receivedResult?.[0]?.total
    ? parseFloat(receivedResult[0].total)
    : 0;

  return {
    sent: Math.floor(sent),
    received: Math.floor(received),
  };
}
