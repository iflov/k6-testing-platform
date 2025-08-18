import _ from 'lodash';

import { SCENARIO } from '../../utils/constants';

export class ScenarioService {
  constructor() {}

  getScenarios() {
    return {
      scenarios: _.keys(SCENARIO),
      description: _.mapValues(SCENARIO, 'description'),
      executors: _.mapValues(SCENARIO, 'executor'),
    };
  }
}
