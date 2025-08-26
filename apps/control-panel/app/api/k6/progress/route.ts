import { NextResponse } from "next/server";
import { Config } from "@/lib/config";

export async function GET(_request: Request) {
  try {
    // 환경변수 가져오기
    const config = Config.getInstance();
    const k6RunnerUrl = config.k6RunnerBaseUrl;

    // 엔드포인트 생성
    const endpoint = `${k6RunnerUrl}/api/test/progress`;

    console.log(`[Progress API] Fetching from: ${endpoint}`);

    // 현재 테스트 진행도 가져오는 API 요청
    const response = await fetch(endpoint, {
      headers: {
        "Content-Type": "application/json",
      },
      // Progress 데이터 캐시 비활성화
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

    // 디버깅 로그
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
