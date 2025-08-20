export const CONSTANTS = {
  DEFAULT_VUS: 10,
  DEFAULT_DURATION: '30s',
  DEFAULT_ITERATIONS: 100,
  DEFAULT_EXECUTION_MODE: 'duration',
  DEFAULT_HTTP_METHOD: 'GET',
  DEFAULT_ERROR_RATE: 10,
  DEFAULT_ERROR_CODES: '400,500,503',
  PROCESS_TIMEOUT_BUFFER: 30, // seconds
  FORCE_KILL_TIMEOUT: 5000, // ms
  PORT_RELEASE_WAIT: 1500, // ms
  PROCESS_EXIT_WAIT: 500, // ms
  PROCESS_KILL_WAIT: 100, // ms
  MAX_KILL_ATTEMPTS: 30,
  LOG_BUFFER_SIZE: 1000, // chars
  SCRIPT_PREVIEW_SIZE: 500, // chars
};

export const HTTP_STATUS = {
  SUCCESS: {
    GET: [200],
    POST: [200, 201],
    PUT: [200, 204],
    PATCH: [200, 204],
    DELETE: [200, 202, 204],
  },
  METHODS_WITH_BODY: ['POST', 'PUT', 'PATCH'],
};

export const SCENARIO = {
  custom: {
    id: 'custom',
    name: 'Custom Test',
    description: 'User-defined test with custom parameters',
    defaultVus: 10,
    defaultDuration: '30s',
    defaultIterations: 1000,
    supportedModes: {
      duration: { enabled: true },
      iterations: { enabled: true },
      hybrid: { enabled: true },
    },
    useStages: false,
    rampPattern: 'none',
    executor: 'constant-vus',
  },
  smoke: {
    id: 'smoke',
    name: 'Smoke Test',
    description: 'Quick test to verify system is working (constant-vus executor)',
    defaultVus: 1,
    defaultDuration: '1m',
    defaultIterations: 100,
    supportedModes: {
      duration: { enabled: true },
      iterations: { enabled: true },
      hybrid: { enabled: true },
    },
    useStages: false,
    rampPattern: 'none',
    executor: 'constant-vus',
  },
  load: {
    id: 'load',
    name: 'Load Test',
    description: 'Standard load test with gradual ramp-up (ramping-vus executor)',
    defaultVus: 20,
    defaultDuration: '5m',
    supportedModes: {
      duration: { enabled: true },
      iterations: { enabled: false },
      hybrid: { enabled: true },
    },
    useStages: true,
    rampPattern: 'standard',
    executor: 'ramping-vus',
  },
  stress: {
    id: 'stress',
    name: 'Stress Test',
    description: 'Gradually increase load to find breaking point (ramping-vus executor)',
    defaultVus: 50,
    defaultDuration: '10m',
    supportedModes: {
      duration: { enabled: true },
      iterations: { enabled: false },
      hybrid: { enabled: false },
    },
    useStages: true,
    rampPattern: 'gradual',
    executor: 'ramping-vus',
  },
  spike: {
    id: 'spike',
    name: 'Spike Test',
    description: 'Sudden increase in load to test system resilience (ramping-vus executor)',
    defaultVus: 100,
    defaultDuration: '5m',
    supportedModes: {
      duration: { enabled: true },
      iterations: { enabled: false },
      hybrid: { enabled: false },
    },
    useStages: true,
    rampPattern: 'aggressive',
    executor: 'ramping-vus',
  },
  soak: {
    id: 'soak',
    name: 'Soak Test',
    description: 'Extended duration test for memory leaks and stability (constant-vus executor)',
    defaultVus: 30,
    defaultDuration: '30m',
    defaultIterations: 10000,
    supportedModes: {
      duration: { enabled: true },
      iterations: { enabled: true },
      hybrid: { enabled: true },
    },
    useStages: false,
    rampPattern: 'none',
    executor: 'constant-vus',
  },
  breakpoint: {
    id: 'breakpoint',
    name: 'Breakpoint Test',
    description: "Find system's maximum capacity (ramping-arrival-rate executor)",
    defaultVus: 100,
    defaultDuration: '20m',
    supportedModes: {
      duration: { enabled: true },
      iterations: { enabled: false },
      hybrid: { enabled: false },
    },
    useStages: true,
    rampPattern: 'gradual',
    executor: 'ramping-arrival-rate',
  },
};
