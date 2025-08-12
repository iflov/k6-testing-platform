import { NextRequest, NextResponse } from "next/server";

const K6_RUNNER_TEST_START_URL =
  process.env.K6_RUNNER_TEST_START_URL ||
  "http://k6-runner:3002/api/test/start";

const K6_RUNNER_TEST_STOP_URL =
  process.env.K6_RUNNER_TEST_STOP_URL || "http://k6-runner:3002/api/test/stop";

const K6_RUNNER_TEST_STATUS_URL =
  process.env.K6_RUNNER_TEST_STATUS_URL ||
  "http://k6-runner:3002/api/test/status";

const K6_DASHBOARD_URL =
  process.env.K6_DASHBOARD_URL || "http://localhost:5665";

const MOCK_SERVER_URL =
  process.env.MOCK_SERVER_URL || "http://mock-server:3001";

// K6 Runner 서비스를 통해 테스트 실행
export async function POST(request: NextRequest) {
  try {
    const {
      vus,
      duration,
      iterations,
      executionMode,
      targetUrl,
      enableDashboard = false,
    } = await request.json();

    console.log(
      "1111111:::",
      vus,
      duration,
      iterations,
      executionMode,
      targetUrl,
      enableDashboard
    );

    // k6-runner 서비스로 요청 전달
    const response = await fetch(K6_RUNNER_TEST_START_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vus: vus || 10,
        duration: duration || "30s",
        iterations: iterations,
        executionMode: executionMode || "duration",
        targetUrl: targetUrl || MOCK_SERVER_URL,
        enableDashboard: enableDashboard, // Dashboard는 필요시에만 활성화
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error || "Failed to start test" },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      testId: result.testId || Date.now().toString(),
      message: "Test started successfully",
      dashboardUrl: result.dashboardUrl || K6_DASHBOARD_URL,
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
    const response = await fetch(K6_RUNNER_TEST_STATUS_URL);

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
              dashboardUrl: K6_DASHBOARD_URL,
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
    const response = await fetch(K6_RUNNER_TEST_STOP_URL, {
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
