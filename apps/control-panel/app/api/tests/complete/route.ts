import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { testId, metrics } = await request.json();

    if (!testId || !metrics) {
      return NextResponse.json(
        { error: 'testId and metrics are required' },
        { status: 400 }
      );
    }

    // Dynamic imports to avoid initialization issues
    const { getTestRunRepository, getTestResultRepository } = await import('@/src/lib/database');
    const { TestStatus } = await import('@/src/entities/TestRun.entity');

    // Get repositories
    const testRunRepo = await getTestRunRepository();
    const testResultRepo = await getTestResultRepository();

    // Find the test run
    const testRun = await testRunRepo.findOne({
      where: { testId },
    });

    if (!testRun) {
      return NextResponse.json(
        { error: 'Test run not found' },
        { status: 404 }
      );
    }

    // Update test run status
    testRun.status = TestStatus.COMPLETED;
    testRun.completedAt = new Date();
    await testRunRepo.save(testRun);

    // Calculate failed requests from error rate
    const totalRequests = metrics.http_reqs?.count || 0;
    const errorRate = metrics.http_req_failed?.rate || 0;
    const failedRequests = Math.round(totalRequests * errorRate);

    // Create test result
    const testResult = testResultRepo.create({
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
      dataReceived: String(metrics.data_received || 0),
      dataSent: String(metrics.data_sent || 0),
      maxVus: metrics.vus_max || metrics.vus || 0,
      avgIterationDuration: metrics.iteration_duration?.avg || null,
      metricsJson: metrics,
    });

    await testResultRepo.save(testResult);

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