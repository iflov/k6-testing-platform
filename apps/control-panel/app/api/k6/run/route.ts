import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import config from "@/lib/config";
import { prisma } from "@/src/lib/prisma";

type TestRunRequestBodyInput = NonNullable<
  Prisma.TestRunUncheckedCreateInput["requestBody"]
>;

function safeJsonParse(value: string): Exclude<TestRunRequestBodyInput, typeof Prisma.JsonNull> {
  try {
    return JSON.parse(value) as Exclude<
      TestRunRequestBodyInput,
      typeof Prisma.JsonNull
    >;
  } catch {
    return value;
  }
}

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
      contentType = "json",
      formFields = [],
      enableDashboard = false,
      enableErrorSimulation = false,
      errorRate = 10,
      errorTypes = {},
    } = await request.json();
    const normalizedFormFields = Array.isArray(formFields) ? formFields : [];

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
        contentType: contentType,
        formFields: normalizedFormFields,
        enableDashboard: enableDashboard,
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
    let historyTracked = true;
    const requestBodyForStorage =
      contentType === "json"
        ? requestBody
        : normalizedFormFields.length > 0
        ? JSON.stringify({ contentType, formFields: normalizedFormFields }, null, 2)
        : null;

    // DB에 테스트 실행 정보 저장
    try {
      await prisma.testRun.create({
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
          requestBody: requestBodyForStorage
            ? safeJsonParse(requestBodyForStorage)
            : Prisma.JsonNull,
          status: "running",
          startedAt: new Date(),
        },
      });
    } catch (error) {
      historyTracked = false;
      console.error("Failed to persist test run to history:", error);
    }

    return NextResponse.json({
      testId: testId,
      message: "Test started successfully",
      dashboardUrl: result.dashboardUrl || config.k6DashboardUrl,
      status: result.status,
      historyTracked,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to start test" },
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
  } catch {
    return NextResponse.json({ activeTests: [] }, { status: 200 });
  }
}

// 테스트 중지
export async function DELETE(_request: NextRequest) {
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

    // DB 상태 업데이트 (POST /api/k6/stop과 동일하게 처리)
    const testId = result.testId;
    if (testId) {
      try {
        const testRun = await prisma.testRun.findUnique({
          where: { testId },
        });

        if (testRun && testRun.status === "running") {
          await prisma.testRun.update({
            where: { id: testRun.id },
            data: {
              status: "cancelled",
              completedAt: new Date(),
            },
          });
        }
      } catch {
        // DB 업데이트 실패해도 stop은 성공으로 처리
      }
    }

    return NextResponse.json({
      message: "Test stopped successfully",
      status: result.status,
      testId,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to stop test" },
      { status: 500 }
    );
  }
}
