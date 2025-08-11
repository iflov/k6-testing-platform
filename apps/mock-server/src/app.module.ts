import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TestModule } from './test/test.module';
import { SuccessModule } from './success/success.module';
import { ErrorModule } from './error/error.module';
import { PerformanceModule } from './performance/performance.module';

@Module({
  imports: [TestModule, SuccessModule, ErrorModule, PerformanceModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
