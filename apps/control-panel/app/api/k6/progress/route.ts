import { NextResponse } from "next/server";
import { Config } from "@/lib/config";

export async function GET(request: Request) {
  try {
    // Use Config instance for consistency
    const config = Config.getInstance();
    const k6RunnerUrl = config.k6RunnerBaseUrl;

    // Construct endpoint based on whether testId is provided
    const endpoint = `${k6RunnerUrl}/api/test/progress`;

    console.log(`[Progress API] Fetching from: ${endpoint}`);

    // Forward request to K6 Runner service
    const response = await fetch(endpoint, {
      headers: {
        "Content-Type": "application/json",
      },
      // Don't cache progress data
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(
        `[Progress API] K6 Runner returned ${response.status}: ${response.statusText}`
      );
      return NextResponse.json(
        { error: `Failed to fetch progress: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Log for debugging
    if (data.progress) {
      console.log(
        `[Progress API] Progress for test ${"current"}: ${
          data.progress.percentage
        }%`
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("[Progress API] Error fetching progress:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch progress",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
