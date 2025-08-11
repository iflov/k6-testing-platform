import { NextRequest, NextResponse } from 'next/server';

// K6 Runner 서비스를 통해 테스트 실행
export async function POST(request: NextRequest) {
  try {
    const { scenario, vus, duration, targetUrl, enableDashboard = true } = await request.json();

    // k6-runner 서비스로 요청 전달
    const response = await fetch('http://k6-runner:3002/api/test/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        vus: vus || 10,
        duration: duration || '30s',
        targetUrl: targetUrl || 'http://mock-server:3001',
        enableDashboard: enableDashboard, // 기본적으로 Dashboard 활성화
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error || 'Failed to start test' },
        { status: response.status }
      );
    }

    const result = await response.json();
    
    return NextResponse.json({
      testId: result.testId || Date.now().toString(),
      message: 'Test started successfully',
      dashboardUrl: result.dashboardUrl || 'http://localhost:5665',
      status: result.status,
    });
  } catch (error) {
    console.error('Failed to start test:', error);
    return NextResponse.json(
      { error: 'Failed to start test', details: error },
      { status: 500 }
    );
  }
}

// 테스트 상태 확인
export async function GET() {
  try {
    const response = await fetch('http://k6-runner:3002/api/test/status');
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to get test status' },
        { status: response.status }
      );
    }

    const status = await response.json();
    
    return NextResponse.json({
      activeTests: status.running ? [{
        id: 'current',
        ...status.details,
        dashboardUrl: 'http://localhost:5665'
      }] : [],
    });
  } catch (error) {
    console.error('Failed to get test status:', error);
    return NextResponse.json(
      { activeTests: [] },
      { status: 200 }
    );
  }
}

// 테스트 중지
export async function DELETE() {
  try {
    const response = await fetch('http://k6-runner:3002/api/test/stop', {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error || 'Failed to stop test' },
        { status: response.status }
      );
    }

    const result = await response.json();
    
    return NextResponse.json({
      message: 'Test stopped successfully',
      status: result.status,
    });
  } catch (error) {
    console.error('Failed to stop test:', error);
    return NextResponse.json(
      { error: 'Failed to stop test', details: error },
      { status: 500 }
    );
  }
}