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
    
    // Prisma initialization error handling
    if (error instanceof Error && error.name === 'PrismaClientInitializationError') {
      console.error('Database connection error - please check DATABASE_URL configuration');
      return NextResponse.json(
        { error: 'Database connection error. Please check server configuration.' },
        { status: 503 }
      );
    }
    
    // Generic error response without exposing internal details
    return NextResponse.json(
      { error: 'Failed to fetch test run. Please try again later.' },
      { status: 500 }
    );
  }
}