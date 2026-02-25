"use client";

import { useState, useEffect, useRef, useCallback } from "react";

import TestController from "@/components/TestController";
import TestStatus from "@/components/TestStatus";
import TestResults from "@/components/TestResults";
import TestProgress from "@/components/TestProgress";

interface Metrics {
  http_req_duration: { avg: number; min: number; max: number; p95: number | null };
  http_reqs: { rate: number };
  vus: number;
  http_req_failed: { rate: number };
  iteration_duration: { avg: number };
}

export default function Home() {
  const [testStatus, setTestStatus] = useState<"idle" | "running">("idle");
  const [testId, setTestId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  // useRef를 사용하여 최신 상태를 항상 참조
  const statusRef = useRef(testStatus);
  const testIdRef = useRef(testId);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const metricsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const errorCountRef = useRef(0);

  // 상태가 변경될 때마다 ref 업데이트
  useEffect(() => {
    statusRef.current = testStatus;
  }, [testStatus]);

  useEffect(() => {
    testIdRef.current = testId;
  }, [testId]);

  // 메트릭 가져오기 함수
  const fetchMetrics = useCallback(async () => {
    if (!testIdRef.current) return;

    try {
      const response = await fetch(
        `/api/k6/metrics?testId=${testIdRef.current}`
      );
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error("Failed to fetch metrics:", error);
    }
  }, []);

  // 테스트 완료 시 결과 저장 함수
  const saveTestResults = useCallback(async (testId: string, metrics: any) => {
    try {
      const response = await fetch("/api/tests/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId, metrics }),
      });

      if (response.ok) {
        // Test results saved successfully
      } else {
        const errorData = await response.json();
        console.error("Failed to save test results:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
        });
      }
    } catch (error) {
      console.error("Error saving test results:", error);
    }
  }, []);

  // 상태 체크 함수 (setTimeout 재귀 방식)
  const checkStatus = useCallback(async () => {
    // 현재 상태가 running이 아니면 중지
    if (statusRef.current !== "running") {
      // Status is not running, stopping polling
      return;
    }

    try {
      const response = await fetch("/api/k6/status");
      const data = await response.json();


      // 에러 카운트 리셋
      errorCountRef.current = 0;

      // 테스트가 더 이상 실행 중이지 않으면
      if (!data.running) {

        // 테스트 완료 시 최종 메트릭을 가져와서 저장
        if (testIdRef.current) {
          try {
            const metricsResponse = await fetch(
              `/api/k6/metrics?testId=${testIdRef.current}`
            );
            const finalMetrics = await metricsResponse.json();
            await saveTestResults(testIdRef.current, finalMetrics);
          } catch (error) {
            console.error("Failed to save test results:", error);
          }
        }

        setTestStatus("idle");
        setTestId(null);
        setMetrics(null);

        // 모든 타임아웃 정리
        if (pollingTimeoutRef.current) {
          clearTimeout(pollingTimeoutRef.current);
          pollingTimeoutRef.current = null;
        }
        if (metricsTimeoutRef.current) {
          clearTimeout(metricsTimeoutRef.current);
          metricsTimeoutRef.current = null;
        }
        return;
      }

      // 테스트가 계속 실행 중이면 다음 체크 스케줄
      if (statusRef.current === "running") {
        pollingTimeoutRef.current = setTimeout(checkStatus, 2000);
      }
    } catch (error) {
      console.error("Failed to check test status:", error);
      errorCountRef.current++;

      // 연속 에러가 10번 이상 발생하면 폴링 중지
      if (errorCountRef.current >= 10) {
        setTestStatus("idle");
        setTestId(null);
        setMetrics(null);
        alert(
          "Lost connection to test runner. Please check the status manually."
        );
        return;
      }

      // 에러가 있어도 재시도
      if (statusRef.current === "running") {
        pollingTimeoutRef.current = setTimeout(checkStatus, 2000);
      }
    }
  }, [saveTestResults]);

  // 메트릭 폴링 함수 (setTimeout 재귀 방식)
  const pollMetrics = useCallback(async () => {
    if (statusRef.current !== "running" || !testIdRef.current) {
      return;
    }

    await fetchMetrics();

    // 다음 메트릭 폴링 스케줄
    if (statusRef.current === "running") {
      metricsTimeoutRef.current = setTimeout(pollMetrics, 2000);
    }
  }, [fetchMetrics]);

  // 컴포넌트 마운트 시 실제 상태 확인
  useEffect(() => {
    const checkInitialStatus = async () => {
      try {
        const response = await fetch("/api/k6/status");
        const data = await response.json();

        if (data.running && data.testId) {
          setTestStatus("running");
          setTestId(data.testId);
        } else {
          setTestStatus("idle");
          setTestId(null);
          setMetrics(null);
        }
      } catch (error) {
        console.error("Failed to check initial status:", error);
      }
    };

    checkInitialStatus();
  }, []);

  // 테스트 상태에 따른 폴링 시작/중지
  useEffect(() => {
    if (testStatus === "running") {

      // 이전 타임아웃 정리
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
      if (metricsTimeoutRef.current) {
        clearTimeout(metricsTimeoutRef.current);
      }

      // 폴링 시작
      checkStatus();
      pollMetrics();
    } else {

      // 모든 폴링 중지
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
        pollingTimeoutRef.current = null;
      }
      if (metricsTimeoutRef.current) {
        clearTimeout(metricsTimeoutRef.current);
        metricsTimeoutRef.current = null;
      }

      // 메트릭 초기화
      setMetrics(null);
    }

    // cleanup 함수
    return () => {
      if (pollingTimeoutRef.current) {
        clearTimeout(pollingTimeoutRef.current);
      }
      if (metricsTimeoutRef.current) {
        clearTimeout(metricsTimeoutRef.current);
      }
    };
  }, [testStatus, testId, checkStatus, pollMetrics]);

  return (
    <main className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Test Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Configure and run load tests, monitor real-time metrics and progress.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <TestController
            onTestStart={(id) => {
              // 모든 폴링 정리
              if (pollingTimeoutRef.current) {
                clearTimeout(pollingTimeoutRef.current);
                pollingTimeoutRef.current = null;
              }
              if (metricsTimeoutRef.current) {
                clearTimeout(metricsTimeoutRef.current);
                metricsTimeoutRef.current = null;
              }
              // 상태 설정
              setTestId(id);
              setTestStatus("running");
              setMetrics(null);
              errorCountRef.current = 0;
            }}
            onTestStop={() => {
              // 모든 폴링 정리
              if (pollingTimeoutRef.current) {
                clearTimeout(pollingTimeoutRef.current);
                pollingTimeoutRef.current = null;
              }
              if (metricsTimeoutRef.current) {
                clearTimeout(metricsTimeoutRef.current);
                metricsTimeoutRef.current = null;
              }
              // 상태 초기화
              setTestStatus("idle");
              setTestId(null);
              setMetrics(null);
            }}
            testStatus={testStatus}
            testId={testId}
          />

          <TestStatus status={testStatus} testId={testId} />
        </div>

        <div className="space-y-6">
          <TestResults testId={testId} status={testStatus} metrics={metrics} />
          {/* Progress Component - Show when test is running */}
          <TestProgress
            testId={testId || undefined}
            isRunning={testStatus === "running"}
          />
        </div>
      </div>
    </main>
  );
}
