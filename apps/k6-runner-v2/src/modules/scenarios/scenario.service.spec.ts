import _ from 'lodash';

import { ScenarioService } from './scenario.service';
import { SCENARIO } from '../../utils/constants';

describe('ScenarioService', () => {
  let scenarioService: ScenarioService;

  beforeEach(() => {
    scenarioService = new ScenarioService();
  });

  it('should return all scenarios', () => {
    const scenarios = scenarioService.getScenarios();
    expect(scenarios.scenarios).toEqual(_.keys(SCENARIO));
    expect(scenarios.description).toEqual(_.mapValues(SCENARIO, 'description'));
    expect(scenarios.executors).toEqual(_.mapValues(SCENARIO, 'executor'));
  });
});
