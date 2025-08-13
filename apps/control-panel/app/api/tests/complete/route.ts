import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { testId, metrics } = await request.json();

    if (!testId || !metrics) {
      return NextResponse.json(
        { error: 'testId and metrics are required' },
        { status: 400 }
      );
    }

    // Find the test run
    const testRun = await prisma.testRun.findUnique({
      where: { testId },
    });

    if (!testRun) {
      return NextResponse.json(
        { error: 'Test run not found' },
        { status: 404 }
      );
    }

    // Update test run status
    const updatedTestRun = await prisma.testRun.update({
      where: { id: testRun.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
      }
    });

    // Calculate failed requests from error rate
    const totalRequests = metrics.http_reqs?.count || 0;
    const errorRate = metrics.http_req_failed?.rate || 0;
    const failedRequests = Math.round(totalRequests * errorRate);

    // Create test result
    const testResult = await prisma.testResult.create({
      data: {
        testRunId: testRun.id,
        totalRequests: totalRequests,
        failedRequests: failedRequests,
        avgResponseTime: metrics.http_req_duration?.avg || 0,
        minResponseTime: metrics.http_req_duration?.min || 0,
        maxResponseTime: metrics.http_req_duration?.max || 0,
        p95ResponseTime: metrics.http_req_duration?.p95 || 0,
        p99ResponseTime: metrics.http_req_duration?.p99 || 0,
        avgRequestRate: metrics.http_reqs?.rate || 0,
        errorRate: errorRate,
        dataReceived: BigInt(Math.floor(metrics.data_received || 0)),
        dataSent: BigInt(Math.floor(metrics.data_sent || 0)),
        maxVus: metrics.vus_max || metrics.vus || 0,
        avgIterationDuration: metrics.iteration_duration?.avg || null,
        metricsJson: metrics,
      }
    });

    // Serialize the response to handle BigInt
    return NextResponse.json({
      success: true,
      message: 'Test results saved successfully',
      testRunId: testRun.id,
      testResultId: testResult.id,
    });
  } catch (error) {
    console.error('Failed to save test results:', error);
    return NextResponse.json(
      { error: 'Failed to save test results', details: error },
      { status: 500 }
    );
  }
}