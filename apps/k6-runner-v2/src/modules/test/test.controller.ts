import { Request, Response } from 'express';

import { TestService } from './test.service';

export class TestController {
  constructor(private readonly testService: TestService) {}

  startTest = async (req: Request, res: Response) => {
    try {
      const result = await this.testService.startTest(req.body);

      return res.status(200).json(result);
    } catch (error: any) {
      if (error.message === 'Another test is already running') {
        const currentTest = this.testService.getCurrentTest();
        return res.status(400).json({
          error: 'Another test is already running',
          message: 'Please stop the current test before starting a new one',
          currentTestId: currentTest?.testId,
          startTime: currentTest?.startTime,
        });
      }
      return res.status(500).json({
        error: 'Failed to start test',
        message: error.message,
      });
    }
  };

  stopTest = async (_req: Request, res: Response) => {
    try {
      const result = await this.testService.stopTest();
      return res.status(200).json(result);
    } catch (error: any) {
      if (error.message === 'No test is currently running') {
        return res.status(400).json({
          error: 'No test is currently running',
          message: 'No active test to stop',
        });
      }
      return res.status(500).json({
        error: 'Failed to stop test',
        message: error.message,
      });
    }
  };

  getStatus = async (_req: Request, res: Response) => {
    try {
      const status = await this.testService.getStatus();
      return res.status(200).json(status);
    } catch (error: any) {
      return res.status(500).json({
        error: 'Failed to get status',
        message: error.message,
      });
    }
  };

  getProgress = async (_req: Request, res: Response) => {
    try {
      const progress = await this.testService.getProgress();
      return res.status(200).json(progress);
    } catch (error: any) {
      return res.status(500).json({
        error: 'Failed to get progress',
        message: error.message,
      });
    }
  };
}
