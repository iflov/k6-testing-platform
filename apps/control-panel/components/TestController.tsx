'use client';

import { useState } from 'react';

interface TestControllerProps {
  onTestStart: (testId: string) => void;
  onTestStop: () => void;
  testStatus: 'idle' | 'running' | 'stopped';
}

const scenarios = [
  { id: 'load', name: 'Load Test', description: 'Constant load over time' },
  { id: 'stress', name: 'Stress Test', description: 'Gradually increase load' },
  { id: 'spike', name: 'Spike Test', description: 'Sudden increase in load' },
  { id: 'soak', name: 'Soak Test', description: 'Extended duration test' },
];

export default function TestController({ onTestStart, onTestStop, testStatus }: TestControllerProps) {
  const [config, setConfig] = useState({
    scenario: 'load',
    vus: 10,
    duration: '30s',
    targetUrl: 'http://mock-server:3001',
  });
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/k6/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await response.json();
      if (data.testId) {
        onTestStart(data.testId);
      }
    } catch (error) {
      console.error('Failed to start test:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await fetch('/api/k6/stop', { method: 'POST' });
      onTestStop();
    } catch (error) {
      console.error('Failed to stop test:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Test Configuration</h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Scenario
          </label>
          <select
            value={config.scenario}
            onChange={(e) => setConfig({ ...config, scenario: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            style={{ 
              color: testStatus === 'running' ? 'rgb(156, 163, 175)' : 'rgb(0, 0, 0)',
              WebkitTextFillColor: testStatus === 'running' ? 'rgb(156, 163, 175)' : 'rgb(0, 0, 0)',
              opacity: 1 
            }}
            disabled={testStatus === 'running'}
          >
            {scenarios.map((scenario) => (
              <option 
                key={scenario.id} 
                value={scenario.id} 
                style={{ color: 'rgb(0, 0, 0)', WebkitTextFillColor: 'rgb(0, 0, 0)' }}
              >
                {scenario.name} - {scenario.description}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Virtual Users (VUs)
          </label>
          <input
            type="number"
            value={config.vus}
            onChange={(e) => setConfig({ ...config, vus: parseInt(e.target.value) || 1 })}
            min="1"
            max="1000"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            style={{ 
              color: testStatus === 'running' ? 'rgb(156, 163, 175)' : 'rgb(0, 0, 0)',
              WebkitTextFillColor: testStatus === 'running' ? 'rgb(156, 163, 175)' : 'rgb(0, 0, 0)',
              opacity: 1 
            }}
            disabled={testStatus === 'running'}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Duration
          </label>
          <input
            type="text"
            value={config.duration}
            onChange={(e) => setConfig({ ...config, duration: e.target.value })}
            placeholder="e.g., 30s, 5m, 1h"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 disabled:bg-gray-100"
            style={{ 
              color: testStatus === 'running' ? 'rgb(156, 163, 175)' : 'rgb(0, 0, 0)',
              WebkitTextFillColor: testStatus === 'running' ? 'rgb(156, 163, 175)' : 'rgb(0, 0, 0)',
              opacity: 1 
            }}
            disabled={testStatus === 'running'}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target URL
          </label>
          <input
            type="text"
            value={config.targetUrl}
            onChange={(e) => setConfig({ ...config, targetUrl: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            style={{ 
              color: testStatus === 'running' ? 'rgb(156, 163, 175)' : 'rgb(0, 0, 0)',
              WebkitTextFillColor: testStatus === 'running' ? 'rgb(156, 163, 175)' : 'rgb(0, 0, 0)',
              opacity: 1 
            }}
            disabled={testStatus === 'running'}
          />
        </div>

        <div className="flex gap-2 pt-4">
          {testStatus !== 'running' ? (
            <button
              onClick={handleStart}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Starting...' : 'Start Test'}
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={loading}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Stopping...' : 'Stop Test'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}