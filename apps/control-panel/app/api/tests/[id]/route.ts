import { NextRequest, NextResponse } from 'next/server';

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  { params }: Params
) {
  const { id } = await params;
  try {
    // Dynamic import to avoid initialization issues
    const { getTestRunRepository } = await import('@/src/lib/database');
    
    const testRunRepo = await getTestRunRepository();
    
    // Try to find by UUID first, then by testId
    let testRun = await testRunRepo
      .createQueryBuilder('testRun')
      .leftJoinAndSelect('testRun.testResult', 'testResult')
      .where('testRun.id = :id', { id })
      .getOne();
    
    if (!testRun) {
      // Try to find by testId
      testRun = await testRunRepo
        .createQueryBuilder('testRun')
        .leftJoinAndSelect('testRun.testResult', 'testResult')
        .where('testRun.testId = :testId', { testId: id })
        .getOne();
    }

    if (!testRun) {
      return NextResponse.json(
        { error: 'Test run not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(testRun);
  } catch (error) {
    console.error('Failed to fetch test run:', error);
    return NextResponse.json(
      { error: 'Failed to fetch test run', details: error },
      { status: 500 }
    );
  }
}