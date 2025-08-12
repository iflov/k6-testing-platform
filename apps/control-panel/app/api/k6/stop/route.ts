import { NextRequest, NextResponse } from 'next/server';
import config from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
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

    return NextResponse.json({
      message: result.message || 'Test stopped successfully',
      status: result.status || 'stopped',
    });
  } catch (error) {
    console.error('Failed to stop test:', error);
    return NextResponse.json(
      { error: 'Failed to stop test', details: error },
      { status: 500 }
    );
  }
}