"use client";

import { useState, useEffect } from "react";

// TestStatus enum을 직접 정의 (Entity import 대신)
enum TestStatus {
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
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
  const [filter, setFilter] = useState<
    "all" | "completed" | "failed" | "running"
  >("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "scenario" | "status">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetchTestHistory();
  }, []);

  const fetchTestHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/tests?limit=100");
      const data = await response.json();

      // API returns data array, not tests array
      if (data.data && Array.isArray(data.data)) {
        setTestRuns(data.data);
      } else if (data.tests && Array.isArray(data.tests)) {
        // Fallback for old API format
        setTestRuns(data.tests);
      } else {
        setTestRuns([]);
      }
    } catch (err) {
      setError("Failed to fetch test history");
      console.error("Error fetching test history:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: TestStatus) => {
    switch (status) {
      case TestStatus.COMPLETED:
        return "bg-green-100 text-green-800";
      case TestStatus.FAILED:
        return "bg-red-100 text-red-800";
      case TestStatus.RUNNING:
        return "bg-blue-100 text-blue-800";
      case TestStatus.CANCELLED:
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return "In progress...";
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

  // Filter and sort tests
  const filteredAndSortedTests = testRuns
    .filter((test) => {
      // Status filter
      if (filter !== "all" && test.status !== filter) return false;

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        return (
          test.testId.toLowerCase().includes(search) ||
          test.scenario.toLowerCase().includes(search) ||
          test.targetUrl.toLowerCase().includes(search) ||
          test.httpMethod.toLowerCase().includes(search)
        );
      }

      return true;
    })
    .sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "date":
          comparison =
            new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
          break;
        case "scenario":
          comparison = a.scenario.localeCompare(b.scenario);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Loading Test History...
        </h2>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Test History
        </h2>
        <div className="text-red-600 mb-4">{error}</div>
        <button
          onClick={fetchTestHistory}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search tests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Filter */}
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date">Sort by Date</option>
            <option value="scenario">Sort by Scenario</option>
            <option value="status">Sort by Status</option>
          </select>

          {/* Sort Order */}
          <button
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            {sortOrder === "asc" ? (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"
                />
              </svg>
            )}
            {sortOrder === "asc" ? "Ascending" : "Descending"}
          </button>

          {/* Refresh */}
          <button
            onClick={fetchTestHistory}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-500">Total Tests</div>
            <div className="text-2xl font-bold text-gray-900">
              {testRuns.length}
            </div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-green-600">Completed</div>
            <div className="text-2xl font-bold text-green-900">
              {testRuns.filter((t) => t.status === TestStatus.COMPLETED).length}
            </div>
          </div>
          <div className="bg-red-50 rounded-lg p-4">
            <div className="text-sm text-red-600">Failed</div>
            <div className="text-2xl font-bold text-red-900">
              {testRuns.filter((t) => t.status === TestStatus.FAILED).length}
            </div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-blue-600">Running</div>
            <div className="text-2xl font-bold text-blue-900">
              {testRuns.filter((t) => t.status === TestStatus.RUNNING).length}
            </div>
          </div>
        </div>

        {/* Test List */}
        {filteredAndSortedTests.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No tests found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Test ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scenario
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Target
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    VUs
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Started
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAndSortedTests.map((test) => (
                  <tr key={test.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">
                      {test.testId.substring(0, 8)}...
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {test.scenario}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${
                          test.httpMethod === "GET"
                            ? "bg-blue-100 text-blue-800"
                            : test.httpMethod === "POST"
                            ? "bg-green-100 text-green-800"
                            : test.httpMethod === "PUT"
                            ? "bg-yellow-100 text-yellow-800"
                            : test.httpMethod === "DELETE"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {test.httpMethod}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      <div
                        className="truncate max-w-xs"
                        title={test.targetUrl + test.urlPath}
                      >
                        {test.urlPath || "/"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {test.vus}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatDuration(test.startedAt, test.completedAt)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(
                          test.status
                        )}`}
                      >
                        {test.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(test.startedAt)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <button
                        onClick={() => setSelectedTest(test)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedTest && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-semibold text-gray-900">
                  Test Details
                </h3>
                <button
                  onClick={() => setSelectedTest(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">
                    Configuration
                  </h4>
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-sm text-gray-500">Test ID</dt>
                      <dd className="text-sm font-mono text-gray-900">
                        {selectedTest.testId}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Scenario</dt>
                      <dd className="text-sm text-gray-900">
                        {selectedTest.scenario}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Execution Mode</dt>
                      <dd className="text-sm text-gray-900">
                        {selectedTest.executionMode}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Virtual Users</dt>
                      <dd className="text-sm text-gray-900">
                        {selectedTest.vus}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Duration</dt>
                      <dd className="text-sm text-gray-900">
                        {selectedTest.duration || "N/A"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Iterations</dt>
                      <dd className="text-sm text-gray-900">
                        {selectedTest.iterations || "N/A"}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">
                    Request Details
                  </h4>
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-sm text-gray-500">HTTP Method</dt>
                      <dd className="text-sm text-gray-900">
                        {selectedTest.httpMethod}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Target URL</dt>
                      <dd className="text-sm text-gray-900 break-all">
                        {selectedTest.targetUrl}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">URL Path</dt>
                      <dd className="text-sm text-gray-900">
                        {selectedTest.urlPath || "/"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Status</dt>
                      <dd>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(
                            selectedTest.status
                          )}`}
                        >
                          {selectedTest.status}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Started At</dt>
                      <dd className="text-sm text-gray-900">
                        {formatDate(selectedTest.startedAt)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-gray-500">Completed At</dt>
                      <dd className="text-sm text-gray-900">
                        {selectedTest.completedAt
                          ? formatDate(selectedTest.completedAt)
                          : "N/A"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              {selectedTest.testResult && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">
                    Test Results
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded p-3">
                      <div className="text-xs text-gray-500">
                        Total Requests
                      </div>
                      <div className="text-xl font-semibold text-gray-900">
                        {selectedTest.testResult.totalRequests.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded p-3">
                      <div className="text-xs text-gray-500">
                        Failed Requests
                      </div>
                      <div className="text-xl font-semibold text-red-600">
                        {selectedTest.testResult.failedRequests.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded p-3">
                      <div className="text-xs text-gray-500">
                        Avg Response Time
                      </div>
                      <div className="text-xl font-semibold text-gray-900">
                        {selectedTest.testResult.avgResponseTime.toFixed(2)}ms
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded p-3">
                      <div className="text-xs text-gray-500">Error Rate</div>
                      <div
                        className={`text-xl font-semibold ${
                          selectedTest.testResult.errorRate > 5
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        {selectedTest.testResult.errorRate.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">
                        Total Duration:
                      </span>
                      <span className="font-bold text-lg text-gray-900">
                        {formatDuration(
                          selectedTest.startedAt,
                          selectedTest.completedAt
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
