"use client";

import { useState } from "react";

import {
  ScenarioId,
  ExecutionMode,
  getScenarioList,
  getScenarioConfig,
} from "@/lib/scenario";
import configModule from "@/lib/config";

interface TestControllerProps {
  onTestStart: (testId: string) => void;
  onTestStop: () => void;
  testStatus: "idle" | "running";
  testId?: string | null;
}

// 중앙 설정에서 시나리오 목록 가져오기
const scenarios = getScenarioList();

// Mock 서버의 사용 가능한 엔드포인트 목록
const availableEndpoints = [
  { method: "GET", path: "/health", description: "Health check" },
  { method: "GET", path: "/success", description: "Success response" },
  { method: "POST", path: "/success", description: "Success with body" },
  { method: "GET", path: "/performance/slow", description: "Slow response (2s delay)" },
  { method: "GET", path: "/performance/timeout", description: "Timeout simulation" },
  { method: "GET", path: "/performance/variable-latency", description: "Random latency" },
  { method: "GET", path: "/performance/concurrency-issue", description: "Concurrency test" },
  { method: "GET", path: "/chaos/random", description: "Random errors (configurable)" },
  { method: "POST", path: "/chaos/random", description: "Random errors with body" },
];


export default function TestController({
  onTestStart,
  onTestStop,
  testStatus,
  testId,
}: TestControllerProps) {
  // 초기 시나리오 설정 가져오기
  const initialScenario = getScenarioConfig("load");
  
  const [config, setConfig] = useState({
    scenario: "load" as ScenarioId,
    vus: initialScenario.defaultVus,
    duration: initialScenario.defaultDuration,
    iterations: initialScenario.defaultIterations || 100,
    executionMode: "duration" as ExecutionMode,
    targetUrl: configModule.mockServerUrl,
    selectedEndpoint: "GET /health",
    urlPath: "/health",
    httpMethod: "GET" as "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    requestBody: JSON.stringify({ message: "Hello from k6!" }, null, 2),
    enableDashboard: false,
    // Error simulation settings
    enableErrorSimulation: false,
    errorRate: 10, // percentage
    errorTypes: {
      400: false,
      401: false,
      403: false,
      404: false,
      429: false,
      500: false,
      502: false,
      503: false,
    },
    useCustomEndpoint: false,
  });
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/k6/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await response.json();
      
      if (response.ok) {
        // 성공 응답
        if (data.testId) {
          onTestStart(data.testId);
        } else {
          // 성공했지만 testId가 없는 경우 (이상한 경우)
          console.error("Test started but no testId received:", data);
        }
      } else {
        // 실패 응답 (4xx, 5xx)
        console.error("Failed to start test:", data.error, data.message);
        alert(data.message || "Failed to start test. Please try again.");
      }
    } catch (error) {
      console.error("Failed to start test:", error);
      alert("Failed to start test. Please check the connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/k6/stop", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId }),
      });
      const data = await response.json();
      
      if (response.ok) {
        console.log("Test stopped successfully:", data);
        onTestStop();
      } else {
        console.error("Failed to stop test:", data.error, data.message);
        // 그래도 UI 상태는 업데이트 (백엔드와 동기화)
        onTestStop();
      }
    } catch (error) {
      console.error("Failed to stop test:", error);
      // 에러가 발생해도 UI 상태는 업데이트
      onTestStop();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Test Configuration
        </h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Scenario
          </label>
          <select
            value={config.scenario}
            onChange={(e) => {
              const newScenario = e.target.value as ScenarioId;
              const newScenarioConfig = getScenarioConfig(newScenario);
              const modes = newScenarioConfig.supportedModes;
              
              // 현재 execution mode가 새 시나리오에서 사용 불가능하면 duration으로 변경
              let newExecutionMode = config.executionMode;
              if (!modes[config.executionMode].enabled) {
                newExecutionMode = "duration"; // duration은 모든 시나리오에서 사용 가능
              }
              
              setConfig({ 
                ...config, 
                scenario: newScenario,
                executionMode: newExecutionMode,
                // 시나리오 기본값으로 업데이트
                vus: newScenarioConfig.defaultVus,
                duration: newScenarioConfig.defaultDuration,
                iterations: newScenarioConfig.defaultIterations || config.iterations,
              });
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            style={{
              color:
                testStatus === "running"
                  ? "rgb(156, 163, 175)"
                  : "rgb(0, 0, 0)",
              WebkitTextFillColor:
                testStatus === "running"
                  ? "rgb(156, 163, 175)"
                  : "rgb(0, 0, 0)",
              opacity: 1,
            }}
            disabled={testStatus === "running"}
          >
            {scenarios.map((scenario) => (
              <option
                key={scenario.id}
                value={scenario.id}
                style={{
                  color: "rgb(0, 0, 0)",
                  WebkitTextFillColor: "rgb(0, 0, 0)",
                }}
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
            onChange={(e) =>
              setConfig({ ...config, vus: parseInt(e.target.value) || 1 })
            }
            min="1"
            max="1000"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
            style={{
              color:
                testStatus === "running"
                  ? "rgb(156, 163, 175)"
                  : "rgb(0, 0, 0)",
              WebkitTextFillColor:
                testStatus === "running"
                  ? "rgb(156, 163, 175)"
                  : "rgb(0, 0, 0)",
              opacity: 1,
            }}
            disabled={testStatus === "running"}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Execution Mode
          </label>
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <button
                type="button"
                onClick={() =>
                  getScenarioConfig(config.scenario).supportedModes.duration.enabled &&
                  setConfig({ ...config, executionMode: "duration" })
                }
                className={`w-full px-3 py-2 rounded-md border transition-colors ${
                  config.executionMode === "duration"
                    ? "bg-blue-600 text-white border-blue-600"
                    : getScenarioConfig(config.scenario).supportedModes.duration.enabled
                    ? "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                disabled={testStatus === "running" || !getScenarioConfig(config.scenario).supportedModes.duration.enabled}
                title={getScenarioConfig(config.scenario).supportedModes.duration.tooltip}
              >
                Duration
              </button>
            </div>
            <div className="relative flex-1 group">
              <button
                type="button"
                onClick={() =>
                  getScenarioConfig(config.scenario).supportedModes.iterations.enabled &&
                  setConfig({ ...config, executionMode: "iterations" })
                }
                className={`w-full px-3 py-2 rounded-md border transition-colors ${
                  config.executionMode === "iterations"
                    ? "bg-blue-600 text-white border-blue-600"
                    : getScenarioConfig(config.scenario).supportedModes.iterations.enabled
                    ? "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                disabled={testStatus === "running" || !getScenarioConfig(config.scenario).supportedModes.iterations.enabled}
                title={getScenarioConfig(config.scenario).supportedModes.iterations.tooltip}
              >
                Iterations
              </button>
              {!getScenarioConfig(config.scenario).supportedModes.iterations.enabled && getScenarioConfig(config.scenario).supportedModes.iterations.tooltip && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="bg-gray-900 text-white text-xs rounded py-2 px-3 max-w-xs whitespace-normal">
                    {getScenarioConfig(config.scenario).supportedModes.iterations.tooltip}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="relative flex-1 group">
              <button
                type="button"
                onClick={() => 
                  getScenarioConfig(config.scenario).supportedModes.hybrid.enabled &&
                  setConfig({ ...config, executionMode: "hybrid" })
                }
                className={`w-full px-3 py-2 rounded-md border transition-colors ${
                  config.executionMode === "hybrid"
                    ? "bg-blue-600 text-white border-blue-600"
                    : getScenarioConfig(config.scenario).supportedModes.hybrid.enabled
                    ? "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                disabled={testStatus === "running" || !getScenarioConfig(config.scenario).supportedModes.hybrid.enabled}
                title={getScenarioConfig(config.scenario).supportedModes.hybrid.tooltip}
              >
                Hybrid
              </button>
              {!getScenarioConfig(config.scenario).supportedModes.hybrid.enabled && getScenarioConfig(config.scenario).supportedModes.hybrid.tooltip && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="bg-gray-900 text-white text-xs rounded py-2 px-3 max-w-xs whitespace-normal">
                    {getScenarioConfig(config.scenario).supportedModes.hybrid.tooltip}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                      <div className="border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {config.executionMode === "duration" ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Duration
            </label>
            <input
              type="text"
              value={config.duration}
              onChange={(e) =>
                setConfig({ ...config, duration: e.target.value })
              }
              placeholder="e.g., 30s, 5m, 1h"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 disabled:bg-gray-100"
              style={{
                color:
                  testStatus === "running"
                    ? "rgb(156, 163, 175)"
                    : "rgb(0, 0, 0)",
                WebkitTextFillColor:
                  testStatus === "running"
                    ? "rgb(156, 163, 175)"
                    : "rgb(0, 0, 0)",
                opacity: 1,
              }}
              disabled={testStatus === "running"}
            />
          </div>
        ) : config.executionMode === "iterations" ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Total Iterations (Total requests to execute)
            </label>
            <input
              type="number"
              value={config.iterations}
              onChange={(e) =>
                setConfig({
                  ...config,
                  iterations: parseInt(e.target.value) || 1,
                })
              }
              min="1"
              max="100000"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              style={{
                color:
                  testStatus === "running"
                    ? "rgb(156, 163, 175)"
                    : "rgb(0, 0, 0)",
                WebkitTextFillColor:
                  testStatus === "running"
                    ? "rgb(156, 163, 175)"
                    : "rgb(0, 0, 0)",
                opacity: 1,
              }}
              disabled={testStatus === "running"}
            />
            <p className="text-xs text-gray-500 mt-1">
              Each VU will execute {Math.ceil(config.iterations / config.vus)}{" "}
              iterations
            </p>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximum Duration (Test stops when this time is reached)
              </label>
              <input
                type="text"
                value={config.duration}
                onChange={(e) =>
                  setConfig({ ...config, duration: e.target.value })
                }
                placeholder="e.g., 30s, 5m, 1h"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder:text-gray-400 disabled:bg-gray-100"
                style={{
                  color:
                    testStatus === "running"
                      ? "rgb(156, 163, 175)"
                      : "rgb(0, 0, 0)",
                  WebkitTextFillColor:
                    testStatus === "running"
                      ? "rgb(156, 163, 175)"
                      : "rgb(0, 0, 0)",
                  opacity: 1,
                }}
                disabled={testStatus === "running"}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Iterations (Test stops when all iterations complete)
              </label>
              <input
                type="number"
                value={config.iterations}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    iterations: parseInt(e.target.value) || 1,
                  })
                }
                min="1"
                max="100000"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                style={{
                  color:
                    testStatus === "running"
                      ? "rgb(156, 163, 175)"
                      : "rgb(0, 0, 0)",
                  WebkitTextFillColor:
                    testStatus === "running"
                      ? "rgb(156, 163, 175)"
                      : "rgb(0, 0, 0)",
                  opacity: 1,
                }}
                disabled={testStatus === "running"}
              />
              <p className="text-xs text-gray-500 mt-1">
                Test will stop when either {config.iterations} iterations
                complete OR {config.duration} elapsed (whichever comes first)
              </p>
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Target Server
          </label>
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfig({ 
                  ...config, 
                  useCustomEndpoint: false,
                  targetUrl: configModule.mockServerUrl,
                  selectedEndpoint: "GET /success",
                  urlPath: "/success",
                  httpMethod: "GET" as "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
                })}
                className={`px-3 py-2 rounded-md border transition-colors ${
                  !config.useCustomEndpoint
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                disabled={testStatus === "running"}
              >
                Mock Server
              </button>
              <button
                type="button"
                onClick={() => setConfig({ 
                  ...config, 
                  useCustomEndpoint: true,
                  targetUrl: "",
                  selectedEndpoint: "custom",
                  urlPath: "/",
                  httpMethod: "GET" as "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
                })}
                className={`px-3 py-2 rounded-md border transition-colors ${
                  config.useCustomEndpoint
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                disabled={testStatus === "running"}
              >
                Custom URL
              </button>
            </div>
            <input
              type="text"
              value={config.targetUrl}
              onChange={(e) => setConfig({ ...config, targetUrl: e.target.value })}
              placeholder={config.useCustomEndpoint ? "https://api.example.com" : "Mock server URL"}
              className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                !config.useCustomEndpoint ? "bg-gray-100 cursor-not-allowed" : ""
              } disabled:bg-gray-100`}
              style={{
                color: testStatus === "running" || !config.useCustomEndpoint
                  ? "rgb(156, 163, 175)"
                  : "rgb(0, 0, 0)",
                WebkitTextFillColor: testStatus === "running" || !config.useCustomEndpoint
                  ? "rgb(156, 163, 175)"
                  : "rgb(0, 0, 0)",
                opacity: 1,
              }}
              disabled={testStatus === "running" || !config.useCustomEndpoint}
              readOnly={!config.useCustomEndpoint}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Endpoint
          </label>
          {!config.useCustomEndpoint ? (
            <select
              value={config.selectedEndpoint}
              onChange={(e) => {
                const selectedValue = e.target.value;
                const endpoint = availableEndpoints.find(
                  ep => `${ep.method} ${ep.path}` === selectedValue
                );
                if (endpoint) {
                  setConfig({
                    ...config,
                    selectedEndpoint: selectedValue,
                    httpMethod: endpoint.method as "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
                    urlPath: endpoint.path,
                  });
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              style={{
                color:
                  testStatus === "running"
                    ? "rgb(156, 163, 175)"
                    : "rgb(0, 0, 0)",
                WebkitTextFillColor:
                  testStatus === "running"
                    ? "rgb(156, 163, 175)"
                    : "rgb(0, 0, 0)",
                opacity: 1,
              }}
              disabled={testStatus === "running"}
            >
              {availableEndpoints.map((endpoint) => (
                <option
                  key={`${endpoint.method}-${endpoint.path}`}
                  value={`${endpoint.method} ${endpoint.path}`}
                  style={{
                    color: "rgb(0, 0, 0)",
                    WebkitTextFillColor: "rgb(0, 0, 0)",
                  }}
                >
                  ({endpoint.method}) {endpoint.path} - {endpoint.description}
                </option>
              ))}
            </select>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  value={config.httpMethod}
                  onChange={(e) => setConfig({ ...config, httpMethod: e.target.value as "GET" | "POST" | "PUT" | "DELETE" | "PATCH" })}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  style={{
                    color: testStatus === "running" ? "rgb(156, 163, 175)" : "rgb(0, 0, 0)",
                    WebkitTextFillColor: testStatus === "running" ? "rgb(156, 163, 175)" : "rgb(0, 0, 0)",
                    opacity: 1,
                  }}
                  disabled={testStatus === "running"}
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                </select>
                <input
                  type="text"
                  value={config.urlPath}
                  onChange={(e) => setConfig({ ...config, urlPath: e.target.value })}
                  placeholder="/api/endpoint"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                  style={{
                    color: testStatus === "running" ? "rgb(156, 163, 175)" : "rgb(0, 0, 0)",
                    WebkitTextFillColor: testStatus === "running" ? "rgb(156, 163, 175)" : "rgb(0, 0, 0)",
                    opacity: 1,
                  }}
                  disabled={testStatus === "running"}
                />
              </div>
              <p className="text-xs text-gray-500">
                Full URL: {config.targetUrl}{config.urlPath}
              </p>
            </div>
          )}
        </div>

        {(config.httpMethod === "POST" || config.httpMethod === "PUT" || config.httpMethod === "PATCH") && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Request Body (JSON)
            </label>
            <textarea
              value={config.requestBody}
              onChange={(e) =>
                setConfig({ ...config, requestBody: e.target.value })
              }
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 font-mono text-sm"
              style={{
                color:
                  testStatus === "running"
                    ? "rgb(156, 163, 175)"
                    : "rgb(0, 0, 0)",
                WebkitTextFillColor:
                  testStatus === "running"
                    ? "rgb(156, 163, 175)"
                    : "rgb(0, 0, 0)",
                opacity: 1,
              }}
              disabled={testStatus === "running"}
              placeholder='{"key": "value"}'
            />
          </div>
        )}

        {/* Error Simulation Section */}
        <div className="border-t pt-4">
          <div className={`border rounded-lg p-4 ${
            config.useCustomEndpoint 
              ? 'bg-gray-50 border-gray-200' 
              : 'bg-orange-50 border-orange-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg className={`w-5 h-5 ${config.useCustomEndpoint ? 'text-gray-400' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <label className={`text-base font-semibold ${
                  config.useCustomEndpoint ? 'text-gray-500' : 'text-gray-800'
                } cursor-pointer`} 
                  htmlFor="error-simulation-toggle">
                  Error Simulation {config.useCustomEndpoint && '(Mock Server Only)'}
                </label>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  id="error-simulation-toggle"
                  type="checkbox"
                  checked={config.enableErrorSimulation && !config.useCustomEndpoint}
                  onChange={(e) =>
                    setConfig({ ...config, enableErrorSimulation: e.target.checked })
                  }
                  disabled={testStatus === "running" || config.useCustomEndpoint}
                  className="sr-only peer"
                />
                <div className={`w-11 h-6 ${
                  config.useCustomEndpoint 
                    ? 'bg-gray-100 cursor-not-allowed' 
                    : 'bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300'
                } rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600`}></div>
              </label>
            </div>
            
            {config.useCustomEndpoint && (
              <div className="text-xs text-gray-500 flex items-start gap-1 mb-3">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>
                  Error simulation is only available when using the Mock Server. 
                  Switch to Mock Server to enable this feature.
                </span>
              </div>
            )}
          
            {config.enableErrorSimulation && !config.useCustomEndpoint && (
              <div className="space-y-4 mt-4">
                <div className="bg-white rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-gray-700">
                      Error Rate
                    </label>
                    <span className="text-lg font-bold text-orange-600">
                      {config.errorRate}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">0%</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={config.errorRate}
                      onChange={(e) =>
                        setConfig({ ...config, errorRate: parseInt(e.target.value) })
                      }
                      disabled={testStatus === "running"}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, rgb(251, 146, 60) 0%, rgb(251, 146, 60) ${config.errorRate}%, rgb(229, 231, 235) ${config.errorRate}%, rgb(229, 231, 235) 100%)`
                      }}
                    />
                    <span className="text-xs text-gray-500">100%</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {config.errorRate === 0 ? "No errors will be simulated" :
                     config.errorRate <= 10 ? "Low error rate - realistic scenario" :
                     config.errorRate <= 30 ? "Moderate error rate - degraded service" :
                     config.errorRate <= 50 ? "High error rate - major issues" :
                     "Extreme error rate - service failure"}
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-3">
                  <label className="text-sm font-semibold text-gray-700 mb-3 block">
                    Error Types to Simulate
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {Object.entries(config.errorTypes).map(([code, enabled]) => {
                      const errorInfo: Record<string, { name: string; color: string }> = {
                        '400': { name: 'Bad Request', color: 'yellow' },
                        '401': { name: 'Unauthorized', color: 'red' },
                        '403': { name: 'Forbidden', color: 'red' },
                        '404': { name: 'Not Found', color: 'gray' },
                        '429': { name: 'Too Many Requests', color: 'orange' },
                        '500': { name: 'Internal Error', color: 'red' },
                        '502': { name: 'Bad Gateway', color: 'purple' },
                        '503': { name: 'Service Unavailable', color: 'orange' }
                      };
                      const info = errorInfo[code] || { name: code, color: 'gray' };
                      
                      return (
                        <label 
                          key={code} 
                          className={`
                            flex items-center space-x-2 p-2 rounded-lg border cursor-pointer
                            transition-all duration-200
                            ${enabled 
                              ? `bg-${info.color}-50 border-${info.color}-300` 
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                            }
                            ${testStatus === "running" ? 'opacity-50 cursor-not-allowed' : ''}
                          `}
                        >
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                errorTypes: {
                                  ...config.errorTypes,
                                  [code]: e.target.checked,
                                },
                              })
                            }
                            disabled={testStatus === "running"}
                            className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                          />
                          <div className="flex-1">
                            <span className="font-semibold text-sm">{code}</span>
                            <span className="text-xs text-gray-600 ml-1">{info.name}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
                
                <div className="text-xs text-gray-500 flex items-start gap-1">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>
                    Error simulation works with Mock Server endpoints. 
                    Selected error types will be randomly returned based on the error rate.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          {testStatus !== "running" ? (
            <button
              onClick={handleStart}
              disabled={loading}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Starting..." : "Start Test"}
            </button>
          ) : (
            <button
              onClick={handleStop}
              disabled={loading}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Stopping..." : "Stop Test"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
