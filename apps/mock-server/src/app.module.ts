import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SuccessModule } from './success/success.module';
import { PerformanceModule } from './performance/performance.module';

@Module({
  imports: [SuccessModule, PerformanceModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
