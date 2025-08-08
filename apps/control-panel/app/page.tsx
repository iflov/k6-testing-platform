'use client';

import { useState } from 'react';
import TestController from '@/components/TestController';
import TestStatus from '@/components/TestStatus';
import TestResults from '@/components/TestResults';

export default function Home() {
  const [testStatus, setTestStatus] = useState<'idle' | 'running' | 'stopped'>('idle');
  const [testId, setTestId] = useState<string | null>(null);

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
              onTestStop={() => setTestStatus('stopped')}
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