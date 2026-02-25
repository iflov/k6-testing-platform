import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { testId, metrics } = await request.json();

    if (!testId || !metrics) {
      return NextResponse.json(
        { error: "testId and metrics are required" },
        { status: 400 }
      );
    }

    // 테스트 실행 찾기
    const testRun = await prisma.testRun.findUnique({
      where: { testId },
    });

    if (!testRun) {
      return NextResponse.json(
        { error: "Test run not found" },
        { status: 404 }
      );
    }

    // 테스트 실행 상태 업데이트
    await prisma.testRun.update({
      where: { id: testRun.id },
      data: {
        status: "completed",
        completedAt: new Date(),
      },
    });

    // 실패한 요청 수 계산
    const totalRequests = metrics.http_reqs?.count || 0;
    const errorRate = metrics.http_req_failed?.rate || 0;
    const failedRequests = Math.round(totalRequests * errorRate);

    // 테스트 결과 생성
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
      },
    });

    // BigInt 직렬화 처리
    return NextResponse.json({
      success: true,
      message: "Test results saved successfully",
      testRunId: testRun.id,
      testResultId: testResult.id,
    });
  } catch (error) {
    // Prisma 초기화 오류 처리
    if (
      error instanceof Error &&
      error.name === "PrismaClientInitializationError"
    ) {
      return NextResponse.json(
        {
          error:
            "Database connection error. Please check server configuration.",
        },
        { status: 503 }
      );
    }

    // 일반적인 오류 응답 (내부 세부 정보 노출 방지)
    return NextResponse.json(
      { error: "Failed to save test results. Please try again later." },
      { status: 500 }
    );
  }
}
