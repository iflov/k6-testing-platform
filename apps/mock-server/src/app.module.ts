import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SuccessModule } from './success/success.module';
import { PerformanceModule } from './performance/performance.module';
import { ChaosModule } from './chaos/chaos.module';
import { ChaosMiddleware } from './middleware/chaos.middleware';

@Module({
  imports: [SuccessModule, PerformanceModule, ChaosModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 카오스 미들웨어를 특정 라우트에만 적용 (카오스 엔드포인트 자체를 제외하여 중복 카오스 방지)
    // 이는 비즈니스 엔드포인트에서 제어된 카오스 시뮬레이션을 허용합니다.
    consumer
      .apply(ChaosMiddleware)
      .exclude('/chaos/(.*)') // 카오스 엔드포인트 자체 제외
      .forRoutes('/health', '/success', '/performance/*');
  }
}
