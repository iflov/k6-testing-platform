import { NextRequest, NextResponse } from "next/server";

import { fetchK6Metrics, isValidTestId } from "@/lib/k6-metrics";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const testId = searchParams.get("testId");
  const realtime = searchParams.get("realtime") === "true";

  if (testId && !isValidTestId(testId)) {
    return NextResponse.json(
      { error: "Invalid testId format" },
      { status: 400 }
    );
  }

  try {
    const timeRange = realtime ? "10s" : "5m";
    const metrics = await fetchK6Metrics(timeRange, testId);

    return NextResponse.json(metrics);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch metrics" },
      { status: 500 }
    );
  }
}
