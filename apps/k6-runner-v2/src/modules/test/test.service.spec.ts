import { TestService } from './test.service';
import { ScenarioService } from '../scenarios/scenario.service';
import { ConfigService } from '../config/config.service';

describe('TestService', () => {
  let service: TestService;
  let scenarioService: ScenarioService;
  let configService: ConfigService;

  beforeEach(() => {
    scenarioService = new ScenarioService();
    configService = ConfigService.getInstance();
    service = new TestService(scenarioService, configService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should test start', async () => {
    // TODO: Implement test
    expect(service).toBeDefined();
  });

  it('should test start with body', async () => {
    // TODO: Implement test
    expect(service).toBeDefined();
  });

  it('should test stop', async () => {
    // TODO: Implement test
    expect(service).toBeDefined();
  });

  it('should test get status', async () => {
    // TODO: Implement test
    expect(service).toBeDefined();
  });

  it('should test get progress', async () => {
    // TODO: Implement test
    expect(service).toBeDefined();
  });
});
