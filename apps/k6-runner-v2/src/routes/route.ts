import { Router } from 'express';

import { container } from '../container';
import { validateTestRequest } from '../middleware/validator';

const router = Router();
const { testController } = container;

router.post('/test/start', validateTestRequest, testController.startTest);
router.post('/test/stop', testController.stopTest);
router.get('/test/status', testController.getStatus);
router.get('/test/progress/:testId?', testController.getProgress);

// router.get('/scenarios', scenarioController.getScenarios);

export default router;
