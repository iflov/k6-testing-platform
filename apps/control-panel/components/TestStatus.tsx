'use client';

interface TestStatusProps {
  status: 'idle' | 'running';
  testId: string | null;
}

export default function TestStatus({ status, testId }: TestStatusProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'running':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'running':
        return (
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        );
      default:
        return (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
          </svg>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">Test Status</h2>
      
      <div className={`flex items-center gap-3 p-4 rounded-lg border ${getStatusColor()}`}>
        {getStatusIcon()}
        <div>
          <p className="font-semibold capitalize">{status}</p>
          {testId && <p className="text-sm opacity-75">Test ID: {testId}</p>}
        </div>
      </div>

      {status === 'running' && (
        <>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              Test is currently running. Metrics are being collected...
            </p>
          </div>
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-yellow-900">📊 K6 Web Dashboard</p>
                <p className="text-sm text-yellow-700 mt-1">
                  View real-time metrics and performance graphs
                </p>
              </div>
              <a
                href="http://localhost:5665"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Open Dashboard
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}