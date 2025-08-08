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

    // Create a simple K6 test script
    const scriptContent = `
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: ${vus},
  duration: '${duration}',
};

export default function () {
  const res = http.get('${targetUrl || 'http://host.docker.internal:3001'}');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
    `;

    // Write temporary script file
    const tempScriptPath = `/tmp/k6-test-${testId}.js`;
    await fs.writeFile(tempScriptPath, scriptContent);

    // Build K6 command using docker with Web Dashboard
    // IMPORTANT: When using --network host, port mapping (-p) is ignored
    // So we need to use the bridge network with explicit port mapping
    const hostScriptsPath = '/Users/ihyeontae/Desktop/Test/k6-testing-platform/k6-scripts';
    const command = `docker run -d --rm \
      --name k6-test-${testId} \
      -p 5665:5665 \
      --add-host=host.docker.internal:host-gateway \
      -e TARGET_URL=${targetUrl || 'http://host.docker.internal:3001'} \
      -e VUS=${vus} \
      -e DURATION=${duration} \
      -e K6_WEB_DASHBOARD=true \
      -e K6_WEB_DASHBOARD_HOST=0.0.0.0 \
      -e K6_WEB_DASHBOARD_PORT=5665 \
      -e K6_WEB_DASHBOARD_PERIOD=1s \
      -v ${path.dirname(tempScriptPath)}:/tmp \
      -v ${hostScriptsPath}:/scripts:ro \
      grafana/k6:0.52.0 run \
      --out influxdb=http://host.docker.internal:8086/k6 \
      /tmp/k6-test-${testId}.js`;

    console.log('Executing K6 command:', command);

    try {
      // Execute K6 test
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr && !stderr.includes('WARNING')) {
        console.error('K6 stderr:', stderr);
      }
      
      console.log('Docker command stdout:', stdout);
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
      console.error('Docker exec error:', execError.message, execError.stderr);
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