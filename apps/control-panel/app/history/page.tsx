'use client';

import TestHistory from '@/components/TestHistory';

export default function HistoryPage() {
  return (
    <main className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Test History</h1>
        <p className="text-gray-600 mt-2">
          View and analyze all your past test results. Click on any test to see detailed metrics and performance data.
        </p>
      </div>
      
      <TestHistory />
    </main>
  );
}