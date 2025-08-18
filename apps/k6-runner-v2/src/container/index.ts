import { TestController } from '../modules/test/test.controller';
import { TestService } from '../modules/test/test.service';

/**
 * Dependency Injection Container
 * 모든 서비스와 컨트롤러의 인스턴스를 중앙에서 관리
 */
class Container {
  private static instance: Container;

  // Services - 순수 비즈니스 로직
  public readonly testService: TestService;

  // Controllers - HTTP 요청/응답 처리
  public readonly testController: TestController;

  private constructor() {
    // 1. 독립적인 서비스들 먼저 생성

    // 2. 의존성이 있는 서비스 생성
    // TestService는 다른 서비스들을 주입받아야 할 수 있음
    this.testService = new TestService();

    // 3. 컨트롤러 생성 (서비스 주입)
    this.testController = new TestController(this.testService);
  }

  /**
   * Singleton 패턴으로 Container 인스턴스 반환
   */
  public static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  /**
   * 테스트용 - Container 인스턴스 리셋
   */
  public static resetInstance(): void {
    Container.instance = null as any;
  }
}

// 싱글톤 인스턴스 export
export const container = Container.getInstance();

// 개별 export (필요한 경우)
export const { testService, testController } = container;
