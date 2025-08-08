import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// Store active test processes
const activeTests = new Map<string, any>();

export async function POST(request: NextRequest) {
  try {
    const { scenario, vus, duration, targetUrl } = await request.json();
    const testId = uuidv4();

    // Create a temporary K6 script with environment variables
    const scriptContent = `
export const options = {
  vus: ${vus},
  duration: '${duration}',
};

export { default } from '/scripts/scenarios/${scenario}-test.js';
    `;

    // Write temporary script file
    const tempScriptPath = `/tmp/k6-test-${testId}.js`;
    await fs.writeFile(tempScriptPath, scriptContent);

    // Build K6 command using docker with Web Dashboard
    // Using host network mode to ensure port binding works from within container
    // Note: This requires adjusting network references
    const command = `docker run -d --rm \
      --name k6-test-${testId} \
      --network host \
      -e TARGET_URL=${targetUrl || 'http://localhost:3001'} \
      -e VUS=${vus} \
      -e DURATION=${duration} \
      -e K6_WEB_DASHBOARD=true \
      -e K6_WEB_DASHBOARD_HOST=0.0.0.0 \
      -e K6_WEB_DASHBOARD_PORT=5665 \
      -e K6_WEB_DASHBOARD_PERIOD=1s \
      -v ${path.dirname(tempScriptPath)}:/tmp \
      -v /scripts:/scripts:ro \
      grafana/k6:latest run \
      --out influxdb=http://localhost:8086/k6 \
      --out web-dashboard \
      /tmp/k6-test-${testId}.js`;

    console.log('Executing K6 command:', command);

    try {
      // Execute K6 test
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && !stderr.includes('WARNING')) {
        console.error('K6 stderr:', stderr);
      }
      
      const containerId = stdout.trim();
      
      activeTests.set(testId, { 
        containerId: containerId || testId, 
        startTime: new Date(),
        scenario,
        vus,
        duration
      });

      // Clean up temp file after a delay
      setTimeout(async () => {
        try {
          await fs.unlink(tempScriptPath);
        } catch (e) {
          console.error('Failed to cleanup temp file:', e);
        }
      }, 5000);

      return NextResponse.json({
        testId,
        message: 'Test started successfully',
        containerId: containerId || testId,
      });
    } catch (execError: any) {
      // If docker is not available, fall back to simulated test
      console.warn('Docker not available, running simulated test');
      
      activeTests.set(testId, { 
        containerId: `simulated-${testId}`, 
        startTime: new Date(),
        scenario,
        vus,
        duration,
        simulated: true
      });

      return NextResponse.json({
        testId,
        message: 'Test started (simulated mode)',
        containerId: `simulated-${testId}`,
        warning: 'Running in simulated mode - Docker not available'
      });
    }
  } catch (error) {
    console.error('Failed to start test:', error);
    return NextResponse.json(
      { error: 'Failed to start test', details: error },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    activeTests: Array.from(activeTests.entries()).map(([id, data]) => ({
      id,
      ...data,
    })),
  });
}