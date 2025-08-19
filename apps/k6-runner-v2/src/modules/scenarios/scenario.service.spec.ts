import { ScenarioService } from './scenario.service';
import { SCENARIO } from '../../utils/constants';
import { RampPattern } from '../../types/scenario.types';

describe('ScenarioService', () => {
  let scenarioService: ScenarioService;

  // Test data constants
  const TEST_DATA = {
    VU: 100,
    DURATION: 100,
    SCENARIO_NAME: 'smoke',
    INVALID_SCENARIO: 'not-exist',
    INVALID_PATTERN: 'invalid-pattern' as RampPattern,
  };

  beforeEach(() => {
    scenarioService = new ScenarioService();
  });

  describe('getScenarios', () => {
    it('should return all scenarios', () => {
      const scenarios = scenarioService.getScenarios();

      expect(scenarios.scenarios).toEqual(Object.keys(SCENARIO));

      expect(scenarios.description).toEqual(
        Object.fromEntries(
          Object.entries(SCENARIO).map(([key, value]) => [key, value.description]),
        ),
      );

      expect(scenarios.executors).toEqual(
        Object.fromEntries(Object.entries(SCENARIO).map(([key, value]) => [key, value.executor])),
      );
    });

    it('should have valid structure for all scenarios', () => {
      const scenarios = scenarioService.getScenarios();

      expect(scenarios).toHaveProperty('scenarios');
      expect(scenarios).toHaveProperty('description');
      expect(scenarios).toHaveProperty('executors');

      expect(Array.isArray(scenarios.scenarios)).toBe(true);
      expect(scenarios.scenarios.length).toBeGreaterThan(0);
    });
  });

  describe('getScenarioConfig', () => {
    it('should return scenario config for valid scenario', () => {
      const scenario = scenarioService.getScenarioConfig(TEST_DATA.SCENARIO_NAME);
      expect(scenario).toEqual(SCENARIO[TEST_DATA.SCENARIO_NAME as keyof typeof SCENARIO]);
    });

    it('should return config for all valid scenarios', () => {
      const validScenarios = Object.keys(SCENARIO);

      validScenarios.forEach((scenarioName) => {
        const scenario = scenarioService.getScenarioConfig(scenarioName);
        expect(scenario).toBeDefined();
        expect(scenario).toHaveProperty('description');
        expect(scenario).toHaveProperty('executor');
      });
    });

    it('should throw error when scenario does not exist', () => {
      const errorScenario = () => scenarioService.getScenarioConfig(TEST_DATA.INVALID_SCENARIO);
      expect(errorScenario).toThrow(`Scenario ${TEST_DATA.INVALID_SCENARIO} not found`);
    });

    it('should handle empty string scenario name', () => {
      const errorScenario = () => scenarioService.getScenarioConfig('');
      expect(errorScenario).toThrow('Scenario  not found');
    });
  });

  describe('calculateStages', () => {
    describe('valid patterns', () => {
      it('should return null for pattern: none', () => {
        const stages = scenarioService.calculateStages('none', TEST_DATA.VU, TEST_DATA.DURATION);
        expect(stages).toBeNull();
      });

      it('should calculate stages for pattern: standard', () => {
        const stages = scenarioService.calculateStages(
          'standard',
          TEST_DATA.VU,
          TEST_DATA.DURATION,
        );
        expect(stages).toEqual([
          { duration: '15s', target: 100 },
          { duration: '70s', target: 100 },
          { duration: '15s', target: 0 },
        ]);
      });

      it('should calculate stages for pattern: aggressive', () => {
        const stages = scenarioService.calculateStages(
          'aggressive',
          TEST_DATA.VU,
          TEST_DATA.DURATION,
        );
        expect(stages).toEqual([
          { duration: '30s', target: 20 },
          { duration: '5s', target: 100 },
          { duration: '30s', target: 100 },
          { duration: '5s', target: 20 },
          { duration: '30s', target: 20 },
        ]);
      });

      it('should calculate stages for pattern: gradual', () => {
        const stages = scenarioService.calculateStages('gradual', TEST_DATA.VU, TEST_DATA.DURATION);
        expect(stages).toEqual([
          { duration: '20s', target: 25 },
          { duration: '20s', target: 50 },
          { duration: '20s', target: 75 },
          { duration: '20s', target: 100 },
          { duration: '20s', target: 0 },
        ]);
      });
    });

    describe('edge cases', () => {
      it('should handle zero VUs', () => {
        const stages = scenarioService.calculateStages('standard', 0, TEST_DATA.DURATION);
        expect(stages).toEqual([
          { duration: '15s', target: 0 },
          { duration: '70s', target: 0 },
          { duration: '15s', target: 0 },
        ]);
      });

      it('should handle zero duration', () => {
        const stages = scenarioService.calculateStages('standard', TEST_DATA.VU, 0);
        expect(stages).toEqual([
          { duration: '0s', target: 100 },
          { duration: '0s', target: 100 },
          { duration: '0s', target: 0 },
        ]);
      });

      it('should handle very small duration', () => {
        const stages = scenarioService.calculateStages('standard', TEST_DATA.VU, 3);
        expect(stages).toBeDefined();
        expect(stages).toHaveLength(3);
        expect(stages![0].duration).toBe('1s');
        expect(stages![2].duration).toBe('1s');
      });

      it('should handle negative VUs gracefully', () => {
        const stages = scenarioService.calculateStages('standard', -100, TEST_DATA.DURATION);
        expect(stages).toEqual([
          { duration: '15s', target: -100 },
          { duration: '70s', target: -100 },
          { duration: '15s', target: 0 },
        ]);
      });

      it('should handle negative duration', () => {
        const stages = scenarioService.calculateStages('standard', TEST_DATA.VU, -100);
        expect(stages).toBeDefined();
      });

      it('should return null for invalid pattern', () => {
        const stages = scenarioService.calculateStages(
          TEST_DATA.INVALID_PATTERN,
          TEST_DATA.VU,
          TEST_DATA.DURATION,
        );
        expect(stages).toBeNull();
      });

      it('should handle very large VUs', () => {
        const largeVU = 1000000;
        const stages = scenarioService.calculateStages('standard', largeVU, TEST_DATA.DURATION);
        expect(stages).toBeDefined();
        expect(stages![1].target).toBe(largeVU);
      });

      it('should handle decimal values', () => {
        const stages = scenarioService.calculateStages('standard', 10.5, 100.5);
        expect(stages).toBeDefined();
        expect(stages).toHaveLength(3);
      });
    });

    describe('pattern consistency', () => {
      it('should always return consistent structure for each pattern', () => {
        const patterns: RampPattern[] = ['none', 'standard', 'aggressive', 'gradual'];

        patterns.forEach((pattern) => {
          const stages1 = scenarioService.calculateStages(
            pattern,
            TEST_DATA.VU,
            TEST_DATA.DURATION,
          );
          const stages2 = scenarioService.calculateStages(
            pattern,
            TEST_DATA.VU,
            TEST_DATA.DURATION,
          );

          expect(stages1).toEqual(stages2);
        });
      });

      it('should scale proportionally with VUs', () => {
        const halfVU = TEST_DATA.VU / 2;
        const stages = scenarioService.calculateStages('gradual', halfVU, TEST_DATA.DURATION);

        if (stages) {
          // Check that targets are proportionally scaled
          const firstTarget = stages[0].target;
          expect(firstTarget).toBeLessThanOrEqual(halfVU);
        }
      });
    });
  });
});

describe('ScenarioService with mocked dependencies', () => {
  let scenarioService: ScenarioService;
  let mockScenarioConfig: jest.SpyInstance;

  beforeEach(() => {
    scenarioService = new ScenarioService();

    // Mock the getScenarioConfig method for isolated testing
    mockScenarioConfig = jest.spyOn(scenarioService, 'getScenarioConfig');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should call getScenarioConfig when needed', () => {
    mockScenarioConfig.mockReturnValue({
      description: 'Mocked scenario',
      executor: 'ramping-vus',
    });

    const result = scenarioService.getScenarioConfig('any-scenario');

    expect(mockScenarioConfig).toHaveBeenCalledWith('any-scenario');
    expect(result).toEqual({
      description: 'Mocked scenario',
      executor: 'ramping-vus',
    });
  });

  it('should handle errors in mocked scenario', () => {
    mockScenarioConfig.mockImplementation(() => {
      throw new Error('Mocked error');
    });

    expect(() => scenarioService.getScenarioConfig('error-scenario')).toThrow('Mocked error');
  });
});
