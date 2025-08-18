import _ from 'lodash';

import { SCENARIO } from '../../utils/constants';
import { RampPattern } from '../../types/scenario.types';

export class ScenarioService {
  constructor() {}

  getScenarios() {
    return {
      scenarios: _.keys(SCENARIO),
      description: _.mapValues(SCENARIO, 'description'),
      executors: _.mapValues(SCENARIO, 'executor'),
    };
  }

  getScenarioConfig(scenarioId: string) {
    const scenario = SCENARIO[scenarioId as keyof typeof SCENARIO];
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    return scenario;
  }

  calculateStages(pattern: RampPattern, vus: number, totalSeconds: number) {
    switch (pattern) {
      case 'none':
        return null;

      case 'standard': {
        const rampUpSeconds = Math.max(1, Math.floor(totalSeconds * 0.15));
        const rampDownSeconds = Math.max(1, Math.floor(totalSeconds * 0.15));
        const steadySeconds = totalSeconds - rampUpSeconds - rampDownSeconds;

        return [
          { duration: `${rampUpSeconds}s`, target: vus },
          { duration: `${steadySeconds}s`, target: vus },
          { duration: `${rampDownSeconds}s`, target: 0 },
        ];
      }

      case 'aggressive': {
        const spikeUpSeconds = Math.max(1, Math.floor(totalSeconds * 0.05));
        const spikeHoldSeconds = Math.floor(totalSeconds * 0.3);
        const normalSeconds = Math.floor(totalSeconds * 0.3);
        const spikeDownSeconds = Math.max(1, Math.floor(totalSeconds * 0.05));

        return [
          { duration: `${normalSeconds}s`, target: Math.floor(vus * 0.2) },
          { duration: `${spikeUpSeconds}s`, target: vus },
          { duration: `${spikeHoldSeconds}s`, target: vus },
          { duration: `${spikeDownSeconds}s`, target: Math.floor(vus * 0.2) },
          { duration: `${normalSeconds}s`, target: Math.floor(vus * 0.2) },
        ];
      }

      case 'gradual': {
        const steps = 4;
        const stepDuration = Math.floor(totalSeconds / (steps + 1));
        const stages = [];

        for (let i = 1; i <= steps; i++) {
          stages.push({
            duration: `${stepDuration}s`,
            target: Math.floor((vus * i) / steps),
          });
        }
        stages.push({ duration: `${stepDuration}s`, target: 0 });

        return stages;
      }

      default:
        return null;
    }
  }
}
