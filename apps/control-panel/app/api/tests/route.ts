import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Dynamic import to avoid initialization issues
    const { getTestRunRepository } = await import('@/src/lib/database');
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status');

    const testRunRepo = await getTestRunRepository();
    
    const queryBuilder = testRunRepo
      .createQueryBuilder('testRun')
      .leftJoinAndSelect('testRun.testResult', 'testResult')
      .orderBy('testRun.startedAt', 'DESC')
      .take(limit)
      .skip(offset);

    if (status) {
      queryBuilder.where('testRun.status = :status', { status });
    }

    const [testRuns, total] = await queryBuilder.getManyAndCount();

    return NextResponse.json({
      data: testRuns,
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