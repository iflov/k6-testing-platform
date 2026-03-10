import { NextRequest, NextResponse } from "next/server";
import { test_status } from "@prisma/client";

import { isValidTestId, type K6Metrics } from "@/lib/k6-metrics";
import { persistTestRunCompletion } from "@/lib/test-run-persistence";

export async function POST(request: NextRequest) {
  try {
    const {
      testId,
      metrics,
      status,
      completedAt,
    }: {
      testId?: string;
      metrics?: K6Metrics;
      status?: test_status;
      completedAt?: string;
    } = await request.json();

    if (!testId) {
      return NextResponse.json({ error: "testId is required" }, { status: 400 });
    }

    if (!isValidTestId(testId)) {
      return NextResponse.json(
        { error: "Invalid testId format" },
        { status: 400 }
      );
    }

    const normalizedStatus =
      status && Object.values(test_status).includes(status)
        ? status
        : test_status.completed;

    const persisted = await persistTestRunCompletion({
      testId,
      metrics: metrics || null,
      status: normalizedStatus,
      completedAt: completedAt ? new Date(completedAt) : new Date(),
    });

    if (!persisted) {
      return NextResponse.json({ error: "Test run not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Test results saved successfully",
      testRunId: persisted.testRun.id,
      testResultId: persisted.testResult?.id || null,
      metricsSaved: persisted.metricsSaved,
    });
  } catch (error) {
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

    return NextResponse.json(
      { error: "Failed to save test results. Please try again later." },
      { status: 500 }
    );
  }
}
