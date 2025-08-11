import { Controller, Get } from '@nestjs/common';

import { SuccessService } from './success.service';

@Controller('success')
export class SuccessController {
  constructor(private readonly successService: SuccessService) {}

  @Get()
  async getSuccess() {
    return this.successService.getSuccess();
  }
}
