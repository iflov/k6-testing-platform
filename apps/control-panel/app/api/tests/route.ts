import { NextRequest, NextResponse } from 'next/server';
import { test_status } from '@prisma/client';
import { prisma } from '@/src/lib/prisma';

// Custom serializer for BigInt
function serializeBigInt(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');

    // Build where clause
    const where = status ? { status: status as test_status } : {};

    // Get test runs with pagination
    const [testRuns, total] = await Promise.all([
      prisma.testRun.findMany({
        where,
        include: {
          testResult: true
        },
        orderBy: {
          startedAt: 'desc'
        },
        take: limit,
        skip: offset
      }),
      prisma.testRun.count({ where })
    ]);

    return NextResponse.json({
      data: serializeBigInt(testRuns),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Failed to fetch test runs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test runs', details: error },
      { status: 500 }
    );
  }
}