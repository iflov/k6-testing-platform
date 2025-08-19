import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { ChaosService, ChaosConfig } from './chaos.service';

@Controller('chaos')
export class ChaosController {
  constructor(private readonly chaosService: ChaosService) {}

  @Get('/random')
  async getRandomError(
    @Query('errorRate') errorRate?: string,
    @Query('statusCodes') statusCodes?: string,
  ) {
    const rate = errorRate ? parseFloat(errorRate) : 0.1; // Default 10% error rate
    const codes = statusCodes
      ? statusCodes.split(',').map(Number)
      : [400, 500, 503];

    return this.chaosService.maybeThrowError(rate, codes);
  }

  @Post('/random')
  async postRandomError(
    @Body() body: any,
    @Query('errorRate') errorRate?: string,
    @Query('statusCodes') statusCodes?: string,
  ) {
    const rate = errorRate ? parseFloat(errorRate) : 0.1;
    const codes = statusCodes
      ? statusCodes.split(',').map(Number)
      : [400, 500, 503];

    return this.chaosService.maybeThrowError(rate, codes, body);
  }

  @Get('/config')
  async getConfig(): Promise<ChaosConfig> {
    return this.chaosService.getConfig();
  }

  @Post('/config')
  async setConfig(@Body() config: Partial<ChaosConfig>): Promise<ChaosConfig> {
    return this.chaosService.setConfig(config);
  }

  @Get('/shutdown')
  async shutdownWithDelay() {
    const delayMs = 1000;

    this.chaosService.crashApplication(delayMs);

    return {
      message: `Server will shutdown in ${delayMs}ms`,
      warning: 'This will kill the server process!',
      delay: delayMs,
    };
  }
}
