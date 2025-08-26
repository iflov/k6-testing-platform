import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

type Params = {
  params: Promise<{ id: string }>;
};

// BigInt 직렬화 커스텀 함수
function serializeBigInt(obj: any): any {
  return JSON.parse(
    JSON.stringify(obj, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    // UUID로 테스트 실행 찾기
    let testRun = await prisma.testRun.findUnique({
      where: { id },
      include: {
        testResult: true,
      },
    });

    if (!testRun) {
      // testId로 테스트 실행 찾기
      testRun = await prisma.testRun.findUnique({
        where: { testId: id },
        include: {
          testResult: true,
        },
      });
    }

    if (!testRun) {
      return NextResponse.json(
        { error: "Test run not found" },
        { status: 404 }
      );
    }

    // BigInt 직렬화 처리
    return NextResponse.json(serializeBigInt(testRun));
  } catch (error) {
    console.error("Failed to fetch test run:", error);

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
      { error: "Failed to fetch test run. Please try again later." },
      { status: 500 }
    );
  }
}
