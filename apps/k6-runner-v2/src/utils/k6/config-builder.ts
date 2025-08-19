export interface K6Tags {
  testId: string;
  scenario: string;
  timestamp: string;
}

export interface K6Stage {
  duration: string;
  target: number;
}

export interface K6Scenario {
  [key: string]: {
    executor: string;
    vus?: number;
    iterations?: number;
    duration?: string;
    maxDuration?: string;
    startVUs?: number;
    stages?: K6Stage[];
  };
}

export const createBaseTags = (testId: string, scenario: string): K6Tags => {
  return {
    testId,
    scenario,
    timestamp: new Date().toISOString(),
  };
};

export const createIterationsScenario = (
  scenario: string,
  vus: number,
  iterations: number,
  duration: string
): K6Scenario => {
  return {
    [`${scenario}_iterations`]: {
      executor: 'shared-iterations',
      vus,
      iterations,
      maxDuration: duration,
    },
  };
};

export const createRampingScenario = (
  scenario: string,
  vus: number,
  stages: K6Stage[]
): K6Scenario => {
  return {
    [`${scenario}_ramping`]: {
      executor: 'ramping-vus',
      startVUs: scenario === 'spike' ? Math.floor(vus * 0.1) : 1,
      stages: stages.map((stage) => ({
        duration: stage.duration,
        target: stage.target,
      })),
    },
  };
};

export const createConstantScenario = (
  scenario: string,
  vus: number,
  duration: string
): K6Scenario => {
  return {
    [`${scenario}_constant`]: {
      executor: 'constant-vus',
      vus,
      duration,
    },
  };
};