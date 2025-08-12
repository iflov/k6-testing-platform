'use client';

import { useState, useEffect } from 'react';
import TestController from '@/components/TestController';
import TestStatus from '@/components/TestStatus';
import TestResults from '@/components/TestResults';

export default function Home() {
  const [testStatus, setTestStatus] = useState<'idle' | 'running'>('idle');
  const [testId, setTestId] = useState<string | null>(null);

  // 컴포넌트 마운트 시 실제 상태 확인
  useEffect(() => {
    const checkInitialStatus = async () => {
      try {
        const response = await fetch('/api/k6/status');
        const data = await response.json();
        console.log('Initial status check on mount:', data);
        
        if (data.running && data.testId) {
          console.log('Found running test on mount, setting status to running');
          setTestStatus('running');
          setTestId(data.testId);
        } else {
          // 실행 중인 테스트가 없으면 확실히 idle 상태로 설정
          setTestStatus('idle');
          setTestId(null);
        }
      } catch (error) {
        console.error('Failed to check initial status:', error);
      }
    };
    
    checkInitialStatus();
  }, []); // 빈 배열로 마운트 시 한 번만 실행

  // k6-runner의 실제 상태를 폴링
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let errorCount = 0;
    
    if (testStatus === 'running') {
      console.log('Starting status polling for running test');
      
      const checkStatus = async () => {
        try {
          const response = await fetch('/api/k6/status');
          const data = await response.json();
          
          console.log('Status check result:', data);
          
          // 성공하면 에러 카운트 리셋
          errorCount = 0;
          
          // 테스트가 더 이상 실행 중이지 않으면
          if (!data.running) {
            // 테스트가 자동으로 종료된 경우 idle 상태로 변경
            console.log('Test completed, stopping polling and setting status to idle');
            setTestStatus('idle');
            setTestId(null); // testId도 초기화
            // interval은 testStatus가 idle로 변경되면서 useEffect cleanup에서 자동으로 정리됨
            return;
          }
        } catch (error) {
          console.error('Failed to check test status:', error);
          errorCount++;
          
          // 연속 에러가 10번 이상 발생하면 폴링 중지
          if (errorCount >= 10) {
            console.error('Too many consecutive errors, stopping status polling');
            setTestStatus('idle');
            setTestId(null);
            alert('Lost connection to test runner. Please check the status manually.');
            return;
          }
        }
      };
      
      // 첫 체크를 즉시 실행
      checkStatus();
      
      // 주기적 체크 설정
      intervalId = setInterval(checkStatus, 2000); // 2초마다 상태 확인
      console.log('Interval created:', intervalId);
    } else {
      console.log('Test status is not running:', testStatus);
    }

    // cleanup 함수 - testStatus가 변경되거나 컴포넌트가 unmount될 때 실행
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        console.log('Cleaning up status polling interval from useEffect cleanup');
      }
    };
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