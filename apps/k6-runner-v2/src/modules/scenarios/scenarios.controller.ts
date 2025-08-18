import { Request, Response } from 'express';

import { ScenarioService } from './scenario.service';

export class ScenariosController {
  constructor(private readonly scenariosService: ScenarioService) {}

  getScenarios = (_req: Request, res: Response) => {
    const scenarios = this.scenariosService.getScenarios();
    res.status(200).json(scenarios);
  };
}
