import { NextRequest, NextResponse } from "next/server";

import { fetchK6Metrics, isValidTestId } from "@/lib/k6-metrics";
import { isValidTimeRange } from "@/lib/runtime-config";

const DEFAULT_REALTIME_TIME_RANGE =
  process.env.K6_METRICS_DEFAULT_TIME_RANGE || "30s";
const DEFAULT_STANDARD_TIME_RANGE =
  process.env.K6_METRICS_STANDARD_TIME_RANGE || "5m";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testId = searchParams.get("testId");
  const realtime = searchParams.get("realtime") === "true";
  const requestedTimeRange = searchParams.get("timeRange");

  if (testId && !isValidTestId(testId)) {
    return NextResponse.json(
      { error: "Invalid testId format" },
      { status: 400 }
    );
  }

  if (requestedTimeRange && !isValidTimeRange(requestedTimeRange)) {
    return NextResponse.json(
      { error: "Invalid timeRange format" },
      { status: 400 }
    );
  }

  try {
    const timeRange =
      requestedTimeRange ||
      (realtime ? DEFAULT_REALTIME_TIME_RANGE : DEFAULT_STANDARD_TIME_RANGE);
    const metrics = await fetchK6Metrics(timeRange, testId);

    return NextResponse.json(metrics);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
