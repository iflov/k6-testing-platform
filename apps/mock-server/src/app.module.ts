import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SuccessModule } from './success/success.module';
import { ErrorModule } from './error/error.module';
import { PerformanceModule } from './performance/performance.module';
import { ApiModule } from './api/api.module';

@Module({
  imports: [SuccessModule, ErrorModule, PerformanceModule, ApiModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
