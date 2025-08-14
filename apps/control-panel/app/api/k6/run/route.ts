import { NextRequest, NextResponse } from "next/server";
import config from "@/lib/config";
import { prisma } from "@/src/lib/prisma";

// K6 Runner 서비스를 통해 테스트 실행
export async function POST(request: NextRequest) {
  try {
    const {
      scenario,
      vus,
      duration,
      iterations,
      executionMode,
      targetUrl,
      urlPath,
      httpMethod,
      requestBody,
      enableDashboard = false,
      enableErrorSimulation = false,
      errorRate = 10,
      errorTypes = {},
    } = await request.json();

    // k6-runner 서비스로 요청 전달
    const response = await fetch(config.k6RunnerTestStartUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        scenario: scenario,
        vus: vus || 10,
        duration: duration || "30s",
        iterations: iterations,
        executionMode: executionMode || "duration",
        targetUrl: targetUrl || config.mockServerUrl,
        urlPath: urlPath,
        httpMethod: httpMethod || "GET",
        requestBody: requestBody,
        enableDashboard: enableDashboard, // Dashboard는 필요시에만 활성화
        enableErrorSimulation: enableErrorSimulation,
        errorRate: errorRate,
        errorTypes: errorTypes,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        {
          error: error.error || "Failed to start test",
          message: error.message || "Failed to start test",
          details: error,
        },
        { status: response.status }
      );
    }

    const result = await response.json();
    const testId = result.testId || Date.now().toString();

    // Save test run to PostgreSQL
    try {
      const testRun = await prisma.testRun.create({
        data: {
          testId: testId,
          scenario: scenario || "default",
          vus: vus || 10,
          duration: duration || "30s",
          iterations: iterations || null,
          executionMode: executionMode || "duration",
          targetUrl: targetUrl || config.mockServerUrl,
          urlPath: urlPath || "/",
          httpMethod: httpMethod || "GET",
          requestBody: requestBody ? JSON.parse(requestBody) : null,
          status: "running",
          startedAt: new Date(),
        },
      });

      console.log("Test run saved to database:", testRun.id);
    } catch (dbError) {
      console.error("Failed to save test run to database:", dbError);
      // Continue even if DB save fails - we don't want to stop the test
    }

    return NextResponse.json({
      testId: testId,
      message: "Test started successfully",
      dashboardUrl: result.dashboardUrl || config.k6DashboardUrl,
      status: result.status,
    });
  } catch (error) {
    console.error("Failed to start test:", error);
    return NextResponse.json(
      { error: "Failed to start test", details: error },
      { status: 500 }
    );
  }
}

// 테스트 상태 확인
export async function GET() {
  try {
    const response = await fetch(config.k6RunnerTestStatusUrl);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to get test status" },
        { status: response.status }
      );
    }

    const status = await response.json();

    return NextResponse.json({
      activeTests: status.running
        ? [
            {
              id: "current",
              ...status.details,
              dashboardUrl: config.k6DashboardUrl,
            },
          ]
        : [],
    });
  } catch (error) {
    console.error("Failed to get test status:", error);
    return NextResponse.json({ activeTests: [] }, { status: 200 });
  }
}

// 테스트 중지
export async function DELETE() {
  try {
    const response = await fetch(config.k6RunnerTestStopUrl, {
      method: "POST",
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error || "Failed to stop test" },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      message: "Test stopped successfully",
      status: result.status,
    });
  } catch (error) {
    console.error("Failed to stop test:", error);
    return NextResponse.json(
      { error: "Failed to stop test", details: error },
      { status: 500 }
    );
  }
}
