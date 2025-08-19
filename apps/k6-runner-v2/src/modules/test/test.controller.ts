import { Request, Response } from 'express';

import { TestService } from './test.service';

export class TestController {
  constructor(private readonly testService: TestService) {}

  startTest = async (req: Request, res: Response) => {
    try {
      const result = await this.testService.startTest(req.body);

      res.status(200).json(result);
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
      res.status(500).json({
        error: 'Failed to start test',
        message: error.message,
      });
    }
  };

  stopTest = async (_req: Request, res: Response) => {
    try {
    } catch (error: any) {}
  };

  getStatus = async (_req: Request, res: Response) => {
    try {
    } catch (error: any) {}
  };

  getProgress = async (req: Request, res: Response) => {
    try {
    } catch (error: any) {}
  };
}
