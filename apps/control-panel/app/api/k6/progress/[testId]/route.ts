import { NextResponse } from "next/server";
import { Config } from "@/lib/config";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ testId: string }> }
) {
  try {
    const { testId } = await params;

    if (!testId) {
      return NextResponse.json(
        { error: "Test ID is required" },
        { status: 400 }
      );
    }

    // 환경변수 가져오기
    const config = Config.getInstance();
    const k6RunnerUrl = config.k6RunnerBaseUrl;
    const endpoint = `${k6RunnerUrl}/api/test/progress/${testId}`;

    console.log(
      `[Progress API] Fetching progress for test ${testId} from: ${endpoint}`
    );

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

      // 404 에러 처리
      if (response.status === 404) {
        return NextResponse.json(
          {
            progress: null,
            message: "Test not found or no progress available",
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { error: `Failed to fetch progress: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // 디버깅 로그
    if (data.progress) {
      console.log(
        `[Progress API] Test ${testId} progress: ${data.progress.percentage}%, status: ${data.progress.status}`
      );
    } else {
      console.log(`[Progress API] No progress data for test ${testId}`);
    }

    return NextResponse.json(data);
  } catch (error) {
    const { testId } = await params;
    console.error(
      `[Progress API] Error fetching progress for test ${testId}:`,
      error
    );
    return NextResponse.json(
      {
        error: "Failed to fetch progress",
        details: error instanceof Error ? error.message : "Unknown error",
        testId: testId,
      },
      { status: 500 }
    );
  }
}
