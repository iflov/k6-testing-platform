import { NextResponse } from "next/server";
import config from "@/lib/config";

// 테스트 상태만 확인하는 경량 엔드포인트
export async function GET() {
  try {
    const response = await fetch(config.k6RunnerTestStatusUrl);

    if (!response.ok) {
      return NextResponse.json(
        { running: false, error: "Failed to get test status" },
        { status: response.status }
      );
    }

    const status = await response.json();

    return NextResponse.json({
      running: status.running,
      testId: status.details?.testId || null,
    });
  } catch (error) {
    console.error("Failed to get test status:", error);
    return NextResponse.json({ running: false }, { status: 200 });
  }
}
