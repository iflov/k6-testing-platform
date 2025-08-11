import { NextRequest, NextResponse } from "next/server";

// InfluxDB 연결 설정
const INFLUXDB_URL = process.env.K6_INFLUXDB_URL || 'http://influxdb:8086';
const INFLUXDB_DB = process.env.K6_INFLUXDB_DB || 'k6';
const USE_MOCK_DATA = process.env.USE_MOCK_DATA === "true" || process.env.NODE_ENV === "development";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testId = searchParams.get("testId");

  if (!testId) {
    return NextResponse.json({ error: "Test ID required" }, { status: 400 });
  }

  // Mock 데이터 사용 여부 확인
  if (USE_MOCK_DATA) {
    return NextResponse.json(generateMockMetrics());
  }

  // 실제 InfluxDB에서 메트릭 조회
  try {
    // 여러 메트릭을 병렬로 조회
    const [
      httpReqDuration,
      httpReqs,
      vus,
      httpReqFailed,
      iterationDuration,
      dataTransfer
    ] = await Promise.all([
      queryHttpReqDuration(),
      queryHttpReqs(),
      queryVUs(),
      queryHttpReqFailed(),
      queryIterationDuration(),
      queryDataTransfer()
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
    
  } catch (error) {
    console.error("Failed to fetch metrics from InfluxDB:", error);
    
    // 개발 환경에서는 Mock 데이터로 폴백
    if (process.env.NODE_ENV === "development") {
      console.log("Falling back to mock data due to InfluxDB error");
      return NextResponse.json(generateMockMetrics());
    }
    
    return NextResponse.json(
      { error: "Failed to fetch metrics", details: String(error) },
      { status: 500 }
    );
  }
}

// InfluxDB 쿼리 헬퍼 함수
async function queryInfluxDB(query: string) {
  const response = await fetch(`${INFLUXDB_URL}/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      db: INFLUXDB_DB,
      q: query,
      epoch: 'ms',
    }),
  });

  if (!response.ok) {
    throw new Error(`InfluxDB query failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.results?.[0]?.series?.[0] || null;
}

// HTTP 요청 지속 시간 메트릭
async function queryHttpReqDuration() {
  const query = `
    SELECT mean("value") as avg, 
           min("value") as min, 
           max("value") as max,
           percentile("value", 95) as p95,
           percentile("value", 99) as p99
    FROM "http_req_duration"
    WHERE time > now() - 5m
    GROUP BY time(10s) fill(none)
    ORDER BY time DESC
    LIMIT 1
  `;

  const series = await queryInfluxDB(query);
  
  if (series?.values?.[0]) {
    const values = series.values[0];
    const columns = series.columns;
    
    return {
      avg: getValueByColumn(values, columns, 'avg') || 0,
      min: getValueByColumn(values, columns, 'min') || 0,
      max: getValueByColumn(values, columns, 'max') || 0,
      p95: getValueByColumn(values, columns, 'p95') || 0,
      p99: getValueByColumn(values, columns, 'p99') || 0,
    };
  }
  
  return { avg: 0, min: 0, max: 0, p95: 0, p99: 0 };
}

// HTTP 요청 수 메트릭
async function queryHttpReqs() {
  const query = `
    SELECT sum("value") as count,
           mean("value") as rate
    FROM "http_reqs"
    WHERE time > now() - 5m
    GROUP BY time(10s) fill(none)
    ORDER BY time DESC
    LIMIT 1
  `;

  const series = await queryInfluxDB(query);
  
  if (series?.values?.[0]) {
    const values = series.values[0];
    const columns = series.columns;
    
    return {
      count: Math.floor(getValueByColumn(values, columns, 'count') || 0),
      rate: getValueByColumn(values, columns, 'rate') || 0,
    };
  }
  
  return { count: 0, rate: 0 };
}

// Virtual Users 메트릭
async function queryVUs() {
  const query = `
    SELECT last("value") as current,
           max("value") as max
    FROM "vus"
    WHERE time > now() - 5m
  `;

  const series = await queryInfluxDB(query);
  
  if (series?.values?.[0]) {
    const values = series.values[0];
    const columns = series.columns;
    
    return {
      current: Math.floor(getValueByColumn(values, columns, 'current') || 0),
      max: Math.floor(getValueByColumn(values, columns, 'max') || 0),
    };
  }
  
  return { current: 0, max: 0 };
}

// 실패한 HTTP 요청 메트릭
async function queryHttpReqFailed() {
  const query = `
    SELECT sum("value") as count,
           mean("value") as rate
    FROM "http_req_failed"
    WHERE time > now() - 5m
    GROUP BY time(10s) fill(0)
    ORDER BY time DESC
    LIMIT 1
  `;

  const series = await queryInfluxDB(query);
  
  if (series?.values?.[0]) {
    const values = series.values[0];
    const columns = series.columns;
    
    const totalReqs = await queryHttpReqs();
    const failedCount = getValueByColumn(values, columns, 'count') || 0;
    const failRate = totalReqs.count > 0 ? failedCount / totalReqs.count : 0;
    
    return {
      count: Math.floor(failedCount),
      rate: failRate,
    };
  }
  
  return { count: 0, rate: 0 };
}

// Iteration 지속 시간 메트릭
async function queryIterationDuration() {
  const query = `
    SELECT mean("value") as avg,
           min("value") as min,
           max("value") as max
    FROM "iteration_duration"
    WHERE time > now() - 5m
    GROUP BY time(10s) fill(none)
    ORDER BY time DESC
    LIMIT 1
  `;

  const series = await queryInfluxDB(query);
  
  if (series?.values?.[0]) {
    const values = series.values[0];
    const columns = series.columns;
    
    return {
      avg: getValueByColumn(values, columns, 'avg') || 0,
      min: getValueByColumn(values, columns, 'min') || 0,
      max: getValueByColumn(values, columns, 'max') || 0,
    };
  }
  
  return { avg: 0, min: 0, max: 0 };
}

// 데이터 전송량 메트릭
async function queryDataTransfer() {
  const querySent = `
    SELECT sum("value") as total
    FROM "data_sent"
    WHERE time > now() - 5m
  `;
  
  const queryReceived = `
    SELECT sum("value") as total
    FROM "data_received"
    WHERE time > now() - 5m
  `;

  const [sentSeries, receivedSeries] = await Promise.all([
    queryInfluxDB(querySent),
    queryInfluxDB(queryReceived)
  ]);
  
  const sent = sentSeries?.values?.[0] 
    ? getValueByColumn(sentSeries.values[0], sentSeries.columns, 'total') || 0
    : 0;
    
  const received = receivedSeries?.values?.[0]
    ? getValueByColumn(receivedSeries.values[0], receivedSeries.columns, 'total') || 0
    : 0;
  
  return {
    sent: Math.floor(sent),
    received: Math.floor(received),
  };
}

// Helper 함수
function getValueByColumn(values: any[], columns: string[], columnName: string): number {
  const index = columns.indexOf(columnName);
  return index >= 0 && values[index] !== null ? Number(values[index]) : 0;
}

// Mock 데이터 생성 함수
function generateMockMetrics() {
  const baseTime = Date.now();
  const timeOffset = (baseTime % 10000) / 10000;

  return {
    timestamp: new Date().toISOString(),
    http_req_duration: {
      avg: 50 + Math.sin(timeOffset * Math.PI * 2) * 30 + Math.random() * 20,
      min: 10 + Math.random() * 10,
      max: 200 + Math.sin(timeOffset * Math.PI) * 100 + Math.random() * 50,
      p95: 150 + Math.sin(timeOffset * Math.PI * 1.5) * 50 + Math.random() * 30,
      p99: 180 + Math.sin(timeOffset * Math.PI * 1.5) * 70 + Math.random() * 40,
    },
    http_reqs: {
      rate: 50 + Math.sin(timeOffset * Math.PI * 3) * 20 + Math.random() * 10,
      count: Math.floor(1000 + timeOffset * 5000),
    },
    vus: Math.floor(
      10 + Math.sin(timeOffset * Math.PI) * 5 + Math.random() * 5
    ),
    vus_max: 50,
    http_req_failed: {
      rate: Math.max(
        0,
        Math.sin(timeOffset * Math.PI * 4) * 0.02 + 0.01 + Math.random() * 0.01
      ),
      count: Math.floor(timeOffset * 100 * Math.random()),
    },
    iteration_duration: {
      avg: 100 + Math.sin(timeOffset * Math.PI * 2.5) * 50 + Math.random() * 30,
      min: 50 + Math.random() * 20,
      max: 300 + Math.random() * 100,
    },
    data_received: Math.floor(1024 * 1024 * (1 + timeOffset * 10)),
    data_sent: Math.floor(512 * 1024 * (1 + timeOffset * 10)),
  };
}