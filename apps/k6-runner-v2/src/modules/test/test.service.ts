import { v4 as uuidv4 } from 'uuid';

import { CONSTANTS } from '../../utils/constants';

export class TestService {
  constructor() {}

  async startTest(body: any) {
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

    const testId = uuidv4();
  }
  async stopTest() {}
  async getStatus() {}
  async getProgress() {}
}
