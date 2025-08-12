'use client';

import { useState, useEffect } from 'react';
import TestController from '@/components/TestController';
import TestStatus from '@/components/TestStatus';
import TestResults from '@/components/TestResults';

export default function Home() {
  const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'stopped'>('idle');
  const [testId, setTestId] = useState<string | null>(null);

  // k6-runner의 실제 상태를 폴링
  useEffect(() => {
    if (testStatus === 'running') {
      const interval = setInterval(async () => {
        try {
          const response = await fetch('/api/k6/status');
          const data = await response.json();
          
          // 테스트가 더 이상 실행 중이지 않으면
          if (!data.running) {
            // 테스트가 자동으로 종료된 경우 idle 상태로 변경
            setTestStatus('idle');
            setTestId(null); // testId도 초기화
            clearInterval(interval);
          }
        } catch (error) {
          console.error('Failed to check test status:', error);
        }
      }, 2000); // 2초마다 상태 확인 (metrics와 동일한 간격)

      return () => clearInterval(interval);
    }
  }, [testStatus]);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">K6 Load Testing Platform</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <TestController 
              onTestStart={(id) => {
                setTestId(id);
                setTestStatus('running');
              }}
              onTestStop={() => {
                setTestStatus('idle');
                setTestId(null);
              }}
              testStatus={testStatus}
            />
            
            <TestStatus status={testStatus} testId={testId} />
          </div>
          
          <div>
            <TestResults testId={testId} status={testStatus} />
          </div>
        </div>
      </div>
    </main>
  );
}