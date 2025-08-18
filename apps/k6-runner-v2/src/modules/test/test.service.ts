import { v4 as uuidv4 } from 'uuid';
import _ from 'lodash';

import { CONSTANTS } from '../../utils/constants';
import { CurrentTest, TestProgress, TestConfig } from '../../types/test.types';

export class TestService {
  private currentTest: CurrentTest | null = null;
  private testProgress: Map<string, TestProgress> = new Map();

  async startTest(body: TestConfig) {
    if (_.isNil(this.currentTest)) {
      throw new Error('Another test is already running');
    }

    const testId: string = uuidv4();
    let scriptPath: string = '';

    try {
      const {
        vus = CONSTANTS.DEFAULT_VUS,
        duration = CONSTANTS.DEFAULT_DURATION,
        iterations,
        executionMode = CONSTANTS.DEFAULT_EXECUTION_MODE,
        targetUrl,
        urlPath = '',
        enableDashboard = false,
        scenario = 'custom',
        httpMethod = CONSTANTS.DEFAULT_HTTP_METHOD,
        requestBody = null,
        enableErrorSimulation = false,
        errorRate = CONSTANTS.DEFAULT_ERROR_RATE,
        errorTypes = {},
      } = body;
    } catch (error: any) {}
  }
  async stopTest() {}
  async getStatus() {}
  async getProgress() {}
}
