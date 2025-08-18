import { TestService } from './test.service';

describe('TestService', () => {
  let service: TestService;

  beforeEach(() => {
    service = new TestService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should test start', async () => {});

  it('should test start with body', async () => {});

  it('should test stop', async () => {});

  it('should test get status', async () => {});

  it('should test get progress', async () => {});
});
