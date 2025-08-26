import { NextRequest, NextResponse } from "next/server";
import { test_status } from "@prisma/client";

import { prisma } from "@/src/lib/prisma";

// BigInt 직렬화 커스텀 함수
function serializeBigInt(obj: any): any {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const status = searchParams.get("status");

    // where 절 생성
    const where = status ? { status: status as test_status } : {};

    // 테스트 실행 조회
    const [testRuns, total] = await Promise.all([
      prisma.testRun.findMany({
        where,
        include: {
          testResult: true,
        },
        orderBy: {
          startedAt: "desc",
        },
        take: limit,
        skip: offset,
      }),
      prisma.testRun.count({ where }),
    ]);

    return NextResponse.json({
      data: serializeBigInt(testRuns),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Failed to fetch test runs:", error);

    // Prisma 초기화 오류 처리
    if (
      error instanceof Error &&
      error.name === "PrismaClientInitializationError"
    ) {
      console.error(
        "Database connection error - please check DATABASE_URL configuration"
      );
      return NextResponse.json(
        {
          error:
            "Database connection error. Please check server configuration.",
        },
        { status: 503 }
      );
    }

    // 일반적인 오류 응답 (내부 세부 정보 노출 방지)
    return NextResponse.json(
      { error: "Failed to fetch test runs. Please try again later." },
      { status: 500 }
    );
  }
}
