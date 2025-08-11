import { Module } from '@nestjs/common';
import { SuccessController } from './success.controller';
import { SuccessService } from './success.service';

@Module({
  controllers: [SuccessController],
  providers: [SuccessService]
})
export class SuccessModule {}
