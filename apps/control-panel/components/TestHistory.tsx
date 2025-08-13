'use client';

import { useState, useEffect } from 'react';

// TestStatus enum을 직접 정의 (Entity import 대신)
enum TestStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

interface TestRun {
  id: string;
  testId: string;
  scenario: string;
  vus: number;
  duration: string | null;
  iterations: number | null;
  executionMode: string;
  targetUrl: string;
  urlPath: string;
  httpMethod: string;
  status: TestStatus;
  startedAt: string;
  completedAt: string | null;
  testResult?: {
    totalRequests: number;
    failedRequests: number;
    avgResponseTime: number;
    errorRate: number;
  };
}

export default function TestHistory() {
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTest, setSelectedTest] = useState<TestRun | null>(null);

  useEffect(() => {
    fetchTestHistory();
  }, []);

  const fetchTestHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tests?limit=10');
      const data = await response.json();
      
      if (response.ok) {
        setTestRuns(data.data);
      } else {
        setError('Failed to fetch test history');
      }
    } catch (err) {
      setError('Error loading test history');
      console.error('Error fetching test history:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: TestStatus) => {
    switch (status) {
      case TestStatus.RUNNING:
        return 'text-blue-600 bg-blue-100';
      case TestStatus.COMPLETED:
        return 'text-green-600 bg-green-100';
      case TestStatus.FAILED:
        return 'text-red-600 bg-red-100';
      case TestStatus.CANCELLED:
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return 'In progress...';
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Test History</h2>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Test History</h2>
        <div className="text-red-600">{error}</div>
        <button 
          onClick={fetchTestHistory}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-gray-800">Test History</h2>
        <button 
          onClick={fetchTestHistory}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {testRuns.length === 0 ? (
        <p className="text-gray-600">No test history available</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2 text-sm font-medium text-gray-700">Test ID</th>
                <th className="text-left py-2 px-2 text-sm font-medium text-gray-700">Scenario</th>
                <th className="text-left py-2 px-2 text-sm font-medium text-gray-700">VUs</th>
                <th className="text-left py-2 px-2 text-sm font-medium text-gray-700">Status</th>
                <th className="text-left py-2 px-2 text-sm font-medium text-gray-700">Duration</th>
                <th className="text-left py-2 px-2 text-sm font-medium text-gray-700">Results</th>
                <th className="text-left py-2 px-2 text-sm font-medium text-gray-700">Started At</th>
              </tr>
            </thead>
            <tbody>
              {testRuns.map((test) => (
                <tr 
                  key={test.id} 
                  className="border-b hover:bg-gray-50 cursor-pointer"
                  onClick={() => setSelectedTest(test)}
                >
                  <td className="py-2 px-2 text-sm text-gray-900 font-mono">
                    {test.testId.substring(0, 8)}...
                  </td>
                  <td className="py-2 px-2 text-sm text-gray-900">{test.scenario}</td>
                  <td className="py-2 px-2 text-sm text-gray-900">{test.vus}</td>
                  <td className="py-2 px-2">
                    <span className={`inline-block px-2 py-1 text-xs rounded-full ${getStatusColor(test.status)}`}>
                      {test.status}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-sm text-gray-900">
                    {formatDuration(test.startedAt, test.completedAt)}
                  </td>
                  <td className="py-2 px-2 text-sm">
                    {test.testResult ? (
                      <div className="text-xs text-gray-900">
                        <div>Reqs: {test.testResult.totalRequests}</div>
                        <div>Avg: {test.testResult.avgResponseTime.toFixed(2)}ms</div>
                        <div className={test.testResult.errorRate > 0 ? 'text-red-600' : 'text-green-600'}>
                          Err: {(test.testResult.errorRate * 100).toFixed(2)}%
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="py-2 px-2 text-sm text-gray-600">
                    {formatDate(test.startedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Test Details Modal */}
      {selectedTest && (
        <div 
          className="fixed inset-0 bg-black/20 flex items-center justify-center z-50"
          onClick={() => setSelectedTest(null)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl p-8 max-w-3xl w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-2xl font-bold mb-6 text-gray-900">Test Details</h3>
            
            <div className="space-y-6">
              {/* Configuration Section */}
              <div className="bg-gray-50 rounded-lg p-5">
                <h4 className="font-semibold text-lg text-gray-800 mb-4">📋 Configuration</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Test ID:</span>
                      <span className="font-mono text-sm text-gray-900">{selectedTest.testId.substring(0, 8)}...</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Scenario:</span>
                      <span className="font-medium text-gray-900">{selectedTest.scenario}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">VUs:</span>
                      <span className="font-medium text-gray-900">{selectedTest.vus}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Mode:</span>
                      <span className="font-medium text-gray-900">{selectedTest.executionMode}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Method:</span>
                      <span className="font-medium text-gray-900">{selectedTest.httpMethod}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Path:</span>
                      <span className="font-medium text-gray-900">{selectedTest.urlPath}</span>
                    </div>
                    {selectedTest.duration && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Duration:</span>
                        <span className="font-medium text-gray-900">{selectedTest.duration}</span>
                      </div>
                    )}
                    {selectedTest.iterations && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Iterations:</span>
                        <span className="font-medium text-gray-900">{selectedTest.iterations}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Target URL:</span>
                    <span className="font-mono text-sm text-gray-900">{selectedTest.targetUrl}</span>
                  </div>
                </div>
              </div>

              {/* Results Section */}
              {selectedTest.testResult && (
                <div className="bg-blue-50 rounded-lg p-5">
                  <h4 className="font-semibold text-lg text-gray-800 mb-4">📊 Results</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-md p-3">
                      <div className="text-gray-600 text-sm mb-1">Total Requests</div>
                      <div className="text-2xl font-bold text-gray-900">{selectedTest.testResult.totalRequests}</div>
                    </div>
                    <div className="bg-white rounded-md p-3">
                      <div className="text-gray-600 text-sm mb-1">Failed Requests</div>
                      <div className="text-2xl font-bold text-red-600">{selectedTest.testResult.failedRequests}</div>
                    </div>
                    <div className="bg-white rounded-md p-3">
                      <div className="text-gray-600 text-sm mb-1">Avg Response Time</div>
                      <div className="text-2xl font-bold text-gray-900">{selectedTest.testResult.avgResponseTime.toFixed(2)}<span className="text-sm font-normal text-gray-600">ms</span></div>
                    </div>
                    <div className="bg-white rounded-md p-3">
                      <div className="text-gray-600 text-sm mb-1">Error Rate</div>
                      <div className={`text-2xl font-bold ${selectedTest.testResult.errorRate > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {(selectedTest.testResult.errorRate * 100).toFixed(2)}<span className="text-sm font-normal">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline Section */}
              <div className="bg-green-50 rounded-lg p-5">
                <h4 className="font-semibold text-lg text-gray-800 mb-4">⏱️ Timeline</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Started:</span>
                    <span className="font-medium text-gray-900">{formatDate(selectedTest.startedAt)}</span>
                  </div>
                  {selectedTest.completedAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Completed:</span>
                      <span className="font-medium text-gray-900">{formatDate(selectedTest.completedAt)}</span>
                    </div>
                  )}
                  <div className="pt-3 border-t border-green-200">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600 font-medium">Total Duration:</span>
                      <span className="font-bold text-lg text-gray-900">{formatDuration(selectedTest.startedAt, selectedTest.completedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setSelectedTest(null)}
              className="mt-6 w-full px-6 py-3 bg-gray-700 text-white font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}