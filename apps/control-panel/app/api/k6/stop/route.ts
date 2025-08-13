import { NextRequest, NextResponse } from 'next/server';
import config from '@/lib/config';
import { prisma } from '@/src/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    // Request body에서 testId 가져오기 (optional)
    const body = await request.json().catch(() => ({}));
    const { testId } = body;

    // k6-runner 서비스의 stop API 호출
    const response = await fetch(config.k6RunnerTestStopUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { 
          error: error.error || 'Failed to stop test',
          message: error.message || 'Failed to stop test',
          details: error 
        },
        { status: response.status }
      );
    }

    const result = await response.json();

    // 테스트가 성공적으로 중지되면 DB 상태 업데이트
    if (testId || result.testId) {
      try {
        
        // testId로 테스트 실행 찾기
        const testRun = await prisma.testRun.findUnique({ 
          where: { testId: testId || result.testId } 
        });
        
        if (testRun && testRun.status === 'running') {
          await prisma.testRun.update({
            where: { id: testRun.id },
            data: {
              status: 'cancelled',
              completedAt: new Date(),
            }
          });
          console.log('Test run status updated to CANCELLED:', testRun.id);
        }
      } catch (dbError) {
        console.error('Failed to update test status in database:', dbError);
        // DB 업데이트 실패해도 stop은 성공으로 처리
      }
    }

    return NextResponse.json({
      message: result.message || 'Test stopped successfully',
      status: result.status || 'stopped',
      testId: testId || result.testId,
    });
  } catch (error) {
    console.error('Failed to stop test:', error);
    return NextResponse.json(
      { error: 'Failed to stop test', details: error },
      { status: 500 }
    );
  }
}