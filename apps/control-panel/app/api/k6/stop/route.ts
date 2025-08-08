import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    // Stop all running K6 containers
    const command = 'docker ps -q --filter "ancestor=grafana/k6:latest" | xargs -r docker stop';
    
    await execAsync(command);

    return NextResponse.json({
      message: 'All tests stopped successfully',
    });
  } catch (error) {
    console.error('Failed to stop tests:', error);
    return NextResponse.json(
      { error: 'Failed to stop tests', details: error },
      { status: 500 }
    );
  }
}