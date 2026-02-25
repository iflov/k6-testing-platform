"use client";

interface TestResultsProps {
  testId: string | null;
  status: "idle" | "running";
  metrics: Metrics | null;
}

interface Metrics {
  http_req_duration: { avg: number; min: number; max: number; p95: number | null };
  http_reqs: { rate: number };
  vus: number;
  http_req_failed: { rate: number };
  iteration_duration: { avg: number };
}

export default function TestResults({
  testId,
  status,
  metrics,
}: TestResultsProps) {
  if (status === "idle") {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Test Results
        </h2>
        <p className="text-gray-600">
          No test results yet. Start a test to see metrics.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-semibold text-gray-800 mb-4">
        Test Results
      </h2>

      {metrics && metrics.http_req_duration && metrics.http_reqs && metrics.http_req_failed ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-600">Avg Response Time</p>
              <p className="text-2xl font-bold text-gray-900">
                {(metrics.http_req_duration.avg ?? 0).toFixed(2)} ms
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-600">Request Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {(metrics.http_reqs.rate ?? 0).toFixed(1)} req/s
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-600">Active VUs</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.vus ?? 0}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded">
              <p className="text-sm text-gray-600">Error Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {((metrics.http_req_failed.rate ?? 0) * 100).toFixed(2)}%
              </p>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded">
            <h3 className="font-semibold text-gray-800 mb-2">
              Response Time Distribution
            </h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Min:</span>
                <span className="font-mono text-gray-900">
                  {(metrics.http_req_duration.min ?? 0).toFixed(2)} ms
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">P95:</span>
                <span className="font-mono text-gray-900">
                  {metrics.http_req_duration.p95 != null
                    ? `${metrics.http_req_duration.p95.toFixed(2)} ms`
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Max:</span>
                <span className="font-mono text-gray-900">
                  {(metrics.http_req_duration.max ?? 0).toFixed(2)} ms
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
          </div>
          <p className="text-gray-600 mt-4">Loading metrics...</p>
        </div>
      )}
    </div>
  );
}
