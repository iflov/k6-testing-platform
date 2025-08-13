import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SuccessModule } from './success/success.module';
import { PerformanceModule } from './performance/performance.module';
import { ChaosModule } from './chaos/chaos.module';

@Module({
  imports: [SuccessModule, PerformanceModule, ChaosModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
