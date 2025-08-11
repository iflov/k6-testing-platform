const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

let currentTest = null;

// CORS 설정 (Control Panel에서 접근 가능하도록)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  next();
});

// 테스트 시작 API
app.post('/api/test/start', async (req, res) => {
  const { vus = 10, duration = '30s', targetUrl } = req.body;
  
  if (currentTest) {
    return res.status(400).json({ error: 'Test already running' });
  }

  const testId = uuidv4();
  
  // K6 스크립트 생성
  const script = `
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: ${vus},
  duration: '${duration}',
};

export default function () {
  const res = http.get('${targetUrl || process.env.MOCK_SERVER_URL || 'http://mock-server:3001'}');
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
  `;

  try {
    // 스크립트 파일 저장
    const scriptPath = `/tmp/k6-test-${testId}.js`;
    await fs.writeFile(scriptPath, script);

    // Web Dashboard는 한 번에 하나의 테스트만 실행 가능
    // 각 테스트의 결과는 HTML로 export
    
    // k6 실행
    const k6Process = spawn('k6', [
      'run',
      '--out', `influxdb=${process.env.INFLUXDB_URL || 'http://influxdb:8086/k6'}`,
      '--out', 'web-dashboard',
      scriptPath
    ], {
      env: {
        ...process.env,
        K6_WEB_DASHBOARD: 'true',
        K6_WEB_DASHBOARD_HOST: '0.0.0.0',
        K6_WEB_DASHBOARD_PORT: '5665',
        K6_WEB_DASHBOARD_PERIOD: '1s',
        K6_WEB_DASHBOARD_EXPORT: `/tmp/k6-dashboard-${testId}.html`
      }
    });

    // 로그 출력
    k6Process.stdout.on('data', (data) => {
      console.log(`[K6 Output]: ${data}`);
    });

    k6Process.stderr.on('data', (data) => {
      console.error(`[K6 Error]: ${data}`);
    });

    currentTest = {
      process: k6Process,
      testId,
      startTime: new Date(),
      vus,
      duration,
      targetUrl,
      scriptPath
    };

    // 프로세스 종료 처리
    k6Process.on('exit', async (code) => {
      console.log(`K6 process exited with code ${code}`);
      
      // 임시 파일 삭제
      if (currentTest && currentTest.scriptPath) {
        try {
          await fs.unlink(currentTest.scriptPath);
        } catch (err) {
          console.error('Failed to delete temp script:', err);
        }
      }
      
      currentTest = null;
    });

    res.json({ 
      status: 'started',
      testId,
      dashboardUrl: `http://localhost:${dashboardPort}`,
      dashboardPort: dashboardPort,
      message: 'Test started successfully'
    });
  } catch (error) {
    console.error('Failed to start test:', error);
    res.status(500).json({ 
      error: 'Failed to start test',
      details: error.message 
    });
  }
});

// 테스트 중지 API
app.post('/api/test/stop', async (req, res) => {
  if (!currentTest) {
    return res.status(400).json({ error: 'No test running' });
  }

  try {
    currentTest.process.kill('SIGTERM');
    
    // 강제 종료 타임아웃
    setTimeout(() => {
      if (currentTest && currentTest.process) {
        currentTest.process.kill('SIGKILL');
      }
    }, 5000);
    
    res.json({ 
      status: 'stopped',
      message: 'Test stopped successfully'
    });
  } catch (error) {
    console.error('Failed to stop test:', error);
    res.status(500).json({ 
      error: 'Failed to stop test',
      details: error.message 
    });
  }
});

// 테스트 상태 확인 API
app.get('/api/test/status', (req, res) => {
  res.json({
    running: !!currentTest,
    details: currentTest ? {
      testId: currentTest.testId,
      startTime: currentTest.startTime,
      vus: currentTest.vus,
      duration: currentTest.duration,
      targetUrl: currentTest.targetUrl
    } : null
  });
});

// 헬스 체크
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    service: 'k6-runner',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`K6 Runner Service listening on port ${PORT}`);
  console.log(`Environment:
    - INFLUXDB_URL: ${process.env.INFLUXDB_URL || 'http://influxdb:8086/k6'}
    - MOCK_SERVER_URL: ${process.env.MOCK_SERVER_URL || 'http://mock-server:3001'}
    - Web Dashboard Port: ${process.env.K6_WEB_DASHBOARD_PORT || '5665'}
  `);
});