import { Body, Controller, Get, Post } from '@nestjs/common';

import { SuccessService } from './success.service';

@Controller('success')
export class SuccessController {
  constructor(private readonly successService: SuccessService) {}

  @Get()
  async getSuccess() {
    return this.successService.getSuccess();
  }

  @Post()
  async postSuccess(@Body() body: any) {
    return this.successService.postSuccess(body);
  }
}
