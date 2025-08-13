import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

type Params = {
  params: Promise<{ id: string }>;
};

// Custom serializer for BigInt
function serializeBigInt(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

export async function GET(
  request: NextRequest,
  { params }: Params
) {
  const { id } = await params;
  try {
    // Try to find by UUID first
    let testRun = await prisma.testRun.findUnique({
      where: { id },
      include: {
        testResult: true
      }
    });
    
    if (!testRun) {
      // Try to find by testId
      testRun = await prisma.testRun.findUnique({
        where: { testId: id },
        include: {
          testResult: true
        }
      });
    }

    if (!testRun) {
      return NextResponse.json(
        { error: 'Test run not found' },
        { status: 404 }
      );
    }

    // Serialize to handle BigInt in testResult
    return NextResponse.json(serializeBigInt(testRun));
  } catch (error) {
    console.error('Failed to fetch test run:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test run', details: error },
      { status: 500 }
    );
  }
}