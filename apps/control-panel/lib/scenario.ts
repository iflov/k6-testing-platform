// 시나리오 타입 정의
export type ScenarioId =
  | "smoke"
  | "load"
  | "stress"
  | "spike"
  | "soak"
  | "breakpoint";

// 실행 모드 타입
export type ExecutionMode = "duration" | "iterations" | "hybrid";

// 시나리오 메타데이터 인터페이스
export interface ScenarioMetadata {
  id: ScenarioId;
  name: string;
  description: string;
  defaultVus: number;
  defaultDuration: string;
  defaultIterations?: number;
  supportedModes: {
    duration: { enabled: boolean; tooltip?: string };
    iterations: { enabled: boolean; tooltip?: string };
    hybrid: { enabled: boolean; tooltip?: string };
  };
  // K6 executor 설정을 위한 추가 정보
  useStages?: boolean;
  rampPattern?: "none" | "standard" | "aggressive" | "gradual";
}

// 중앙 시나리오 설정
export const scenarioConfigs: Record<ScenarioId, ScenarioMetadata> = {
  smoke: {
    id: "smoke",
    name: "Smoke Test",
    description: "Quick test to verify basic functionality",
    defaultVus: 1,
    defaultDuration: "1m",
    supportedModes: {
      duration: { enabled: true },
      iterations: { enabled: true },
      hybrid: { enabled: true },
    },
    useStages: false,
    rampPattern: "none",
  },
  load: {
    id: "load",
    name: "Load Test",
    description: "Constant load over time with ramp up/down",
    defaultVus: 20,
    defaultDuration: "5m",
    supportedModes: {
      duration: { enabled: true },
      iterations: {
        enabled: false,
        tooltip:
          "Load test requires duration-based execution for proper ramp patterns",
      },
      hybrid: { enabled: true },
    },
    useStages: true,
    rampPattern: "standard",
  },
  stress: {
    id: "stress",
    name: "Stress Test",
    description: "Gradually increase load to find breaking point",
    defaultVus: 50,
    defaultDuration: "10m",
    supportedModes: {
      duration: { enabled: true },
      iterations: {
        enabled: false,
        tooltip:
          "Stress test requires duration-based execution for gradual load increase",
      },
      hybrid: {
        enabled: false,
        tooltip:
          "Stress test uses staged approach incompatible with hybrid mode",
      },
    },
    useStages: true,
    rampPattern: "gradual",
  },
  spike: {
    id: "spike",
    name: "Spike Test",
    description: "Sudden increase in load to test system resilience",
    defaultVus: 100,
    defaultDuration: "5m",
    supportedModes: {
      duration: { enabled: true },
      iterations: {
        enabled: false,
        tooltip: "Spike test requires precise timing control",
      },
      hybrid: {
        enabled: false,
        tooltip: "Spike patterns incompatible with hybrid execution",
      },
    },
    useStages: true,
    rampPattern: "aggressive",
  },
  soak: {
    id: "soak",
    name: "Soak Test",
    description: "Extended duration test for memory leaks and stability",
    defaultVus: 30,
    defaultDuration: "30m",
    defaultIterations: 10000,
    supportedModes: {
      duration: { enabled: true },
      iterations: { enabled: true },
      hybrid: { enabled: true },
    },
    useStages: false,
    rampPattern: "none",
  },
  breakpoint: {
    id: "breakpoint",
    name: "Breakpoint Test",
    description: "Find system's maximum capacity",
    defaultVus: 100,
    defaultDuration: "20m",
    supportedModes: {
      duration: { enabled: true },
      iterations: {
        enabled: false,
        tooltip: "Breakpoint test requires continuous load increase",
      },
      hybrid: {
        enabled: false,
        tooltip: "Breakpoint test uses ramping VU executor",
      },
    },
    useStages: true,
    rampPattern: "gradual",
  },
};

// 시나리오 목록 가져오기
export const getScenarioList = () => {
  return Object.values(scenarioConfigs).map(({ id, name, description }) => ({
    id,
    name,
    description,
  }));
};

// 특정 시나리오 설정 가져오기
export const getScenarioConfig = (id: ScenarioId): ScenarioMetadata => {
  return scenarioConfigs[id];
};

// K6 Executor 설정 생성을 위한 헬퍼 함수
export const getExecutorStrategy = (
  scenario: ScenarioMetadata,
  executionMode: ExecutionMode
) => {
  // 시나리오와 실행 모드에 따른 전략 반환
  if (!scenario.supportedModes[executionMode].enabled) {
    throw new Error(
      `Execution mode '${executionMode}' is not supported for scenario '${scenario.id}'`
    );
  }

  return {
    useStages: scenario.useStages,
    rampPattern: scenario.rampPattern,
    executionMode,
  };
};
