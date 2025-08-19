import { Router } from 'express';

import { container } from '../container/container';
import { validateTestRequest } from '../middleware/validator';
import { sanitizeString } from '../middleware/sanitizeString';

const router = Router();
const { testController, scenariosController } = container;

router.post('/test/start', validateTestRequest, sanitizeString, testController.startTest);
router.post('/test/stop', testController.stopTest);
router.get('/test/status', testController.getStatus);
router.get('/test/progress/:testId?', testController.getProgress);

router.get('/scenarios', scenariosController.getScenarios);

export default router;
