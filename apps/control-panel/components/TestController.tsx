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
}

// 중앙 설정에서 시나리오 목록 가져오기
const scenarios = getScenarioList();

// Mock 서버의 사용 가능한 엔드포인트 목록
const availableEndpoints = [
  { method: "GET", path: "/", description: "Root endpoint" },
  { method: "GET", path: "/health", description: "Health check" },
  { method: "GET", path: "/success", description: "Success response" },
  { method: "POST", path: "/success", description: "Success with body" },
  { method: "GET", path: "/performance/slow", description: "Slow response (2s delay)" },
  { method: "GET", path: "/performance/timeout", description: "Timeout simulation" },
  { method: "GET", path: "/performance/variable-latency", description: "Random latency" },
  { method: "GET", path: "/performance/concurrency-issue", description: "Concurrency test" },
];


export default function TestController({
  onTestStart,
  onTestStop,
  testStatus,
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
    selectedEndpoint: "GET /success",
    urlPath: "/success",
    httpMethod: "GET" as "GET" | "POST",
    requestBody: JSON.stringify({ message: "Hello from k6!" }, null, 2),
    enableDashboard: false,
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
      const response = await fetch("/api/k6/stop", { method: "POST" });
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
            Target Server (Mock Server)
          </label>
          <input
            type="text"
            value={config.targetUrl}
            readOnly
            className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
            style={{
              WebkitTextFillColor: "rgb(107, 114, 128)",
            }}
            title="Mock server URL is fixed for testing endpoints"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Endpoint
          </label>
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
                  httpMethod: endpoint.method as "GET" | "POST",
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
        </div>

        {config.httpMethod === "POST" && (
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
