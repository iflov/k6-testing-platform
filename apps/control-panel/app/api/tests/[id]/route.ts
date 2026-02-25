import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { serializeBigInt } from "@/lib/serialize";

type Params = {
  params: Promise<{ id: string }>;
};

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
    // Prisma 초기화 오류 처리
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

    // 일반적인 오류 응답 (내부 세부 정보 노출 방지)
    return NextResponse.json(
      { error: "Failed to fetch test run. Please try again later." },
      { status: 500 }
    );
  }
}
