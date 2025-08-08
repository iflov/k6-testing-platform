import { NextRequest, NextResponse } from 'next/server';

// Mock metrics for development
// In production, these would come from InfluxDB
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testId = searchParams.get('testId');

  if (!testId) {
    return NextResponse.json({ error: 'Test ID required' }, { status: 400 });
  }

  // Generate mock metrics
  const mockMetrics = {
    http_req_duration: {
      avg: 50 + Math.random() * 100,
      min: 10 + Math.random() * 20,
      max: 200 + Math.random() * 300,
      p95: 150 + Math.random() * 100,
    },
    http_reqs: {
      rate: 50 + Math.random() * 50,
    },
    vus: Math.floor(10 + Math.random() * 40),
    http_req_failed: {
      rate: Math.random() * 0.05, // 0-5% error rate
    },
    iteration_duration: {
      avg: 100 + Math.random() * 200,
    },
  };

  return NextResponse.json(mockMetrics);
}