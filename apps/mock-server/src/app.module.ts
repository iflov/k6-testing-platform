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
    // Apply chaos middleware to specific routes only (not /chaos/* to avoid double chaos)
    // This allows controlled chaos simulation on business endpoints
    consumer
      .apply(ChaosMiddleware)
      .exclude('/chaos/(.*)') // Exclude chaos endpoints themselves
      .forRoutes('/health', '/success', '/performance/*');
  }
}
