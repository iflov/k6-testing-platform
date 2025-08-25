'use client';

import { useEffect, useState } from 'react';

interface TestProgress {
  currentTime: string;
  currentVUs: number;
  totalVUs: number;
  completedIterations: number;
  interruptedIterations: number;
  percentage: number;
  status: string;
  startTime: string;
}

interface TestProgressProps {
  testId?: string | null;
  isRunning: boolean;
}

export default function TestProgress({ testId, isRunning }: TestProgressProps) {
  const [progress, setProgress] = useState<TestProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isRunning) {
      setProgress(null);
      return;
    }

    const fetchProgress = async () => {
      try {
        const endpoint = testId 
          ? `http://localhost:3002/api/test/progress/${testId}`
          : 'http://localhost:3002/api/test/progress';
        
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error('Failed to fetch progress');
        }
        
        const data = await response.json();
        if (data.progress) {
          setProgress(data.progress);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching progress:', err);
        setError('Unable to fetch progress');
      }
    };

    // Initial fetch
    fetchProgress();

    // Poll for updates every second
    const interval = setInterval(fetchProgress, 1000);

    return () => clearInterval(interval);
  }, [testId, isRunning]);

  if (!isRunning || !progress) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Test Progress</h2>
      
      {error ? (
        <div className="text-red-500 text-sm">{error}</div>
      ) : (
        <div className="space-y-4">
          {/* Progress Bar */}
          <div className="w-full">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progress</span>
              <span>{progress.percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-8 relative overflow-hidden">
              <div 
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-full rounded-full transition-all duration-500 ease-out flex items-center justify-center relative"
                style={{ width: `${progress.percentage}%` }}
              >
                {progress.percentage >= 10 && (
                  <span className="text-white text-sm font-semibold absolute right-2">
                    {progress.percentage}%
                  </span>
                )}
              </div>
              {progress.percentage < 10 && (
                <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-700 text-sm font-semibold">
                  {progress.percentage}%
                </span>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">Running Time</div>
              <div className="text-lg font-semibold text-gray-800">{progress.currentTime}</div>
            </div>
            
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">Active VUs</div>
              <div className="text-lg font-semibold text-gray-800">
                {progress.currentVUs}/{progress.totalVUs}
              </div>
            </div>
            
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">Iterations</div>
              <div className="text-lg font-semibold text-gray-800">
                {progress.completedIterations}
                {progress.interruptedIterations > 0 && (
                  <span className="text-sm text-red-500 ml-1">
                    ({progress.interruptedIterations} failed)
                  </span>
                )}
              </div>
            </div>
            
            <div className="bg-gray-50 rounded p-3">
              <div className="text-xs text-gray-500 mb-1">Status</div>
              <div className="text-lg font-semibold">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  progress.status === 'starting'
                    ? 'bg-yellow-100 text-yellow-800'
                    : progress.status === 'running' 
                    ? 'bg-blue-100 text-blue-800' 
                    : progress.status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  <span className={`w-2 h-2 mr-1 rounded-full ${
                    progress.status === 'starting'
                      ? 'bg-yellow-500 animate-pulse'
                      : progress.status === 'running' 
                      ? 'bg-blue-500 animate-pulse' 
                      : progress.status === 'completed'
                      ? 'bg-green-500'
                      : 'bg-gray-500'
                  }`}></span>
                  {progress.status.charAt(0).toUpperCase() + progress.status.slice(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Visual Progress Indicator */}
          <div className="mt-4 flex items-center justify-center">
            <div className="relative">
              <svg className="w-32 h-32">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-200"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - progress.percentage / 100)}`}
                  className="text-blue-500 transform -rotate-90 origin-center transition-all duration-500"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-800">{progress.percentage}%</div>
                  <div className="text-xs text-gray-500">Complete</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}