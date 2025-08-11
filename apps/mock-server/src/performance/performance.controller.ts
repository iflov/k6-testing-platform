import { Controller, Get, Query, ParseIntPipe } from '@nestjs/common';
import { PerformanceService } from './performance.service';

@Controller('performance')
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  @Get('/slow')
  async getSlow(
    @Query('delay', new ParseIntPipe({ optional: true })) delay?: number,
  ) {
    return this.performanceService.getSlow(delay);
  }

  @Get('/timeout')
  async getTimeout(
    @Query('timeout', new ParseIntPipe({ optional: true })) timeout?: number,
  ) {
    return this.performanceService.getTimeout(timeout);
  }

  @Get('/heavy')
  async getHeavy(
    @Query('complexity', new ParseIntPipe({ optional: true }))
    complexity?: number,
  ) {
    return this.performanceService.getHeavy(complexity);
  }

  @Get('/variable-latency')
  async getVariableLatency(
    @Query('min', new ParseIntPipe({ optional: true })) min?: number,
    @Query('max', new ParseIntPipe({ optional: true })) max?: number,
  ) {
    return this.performanceService.getVariableLatency(min, max);
  }

  @Get('/memory-leak')
  async getMemoryLeak(
    @Query('size', new ParseIntPipe({ optional: true })) size?: number,
  ) {
    return this.performanceService.getMemoryLeak(size);
  }

  @Get('/concurrency-issue')
  async getConcurrencyIssue() {
    return this.performanceService.getConcurrencyIssue();
  }
}
