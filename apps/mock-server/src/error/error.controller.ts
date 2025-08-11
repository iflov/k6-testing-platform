import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ErrorService } from './error.service';

@Controller('error')
export class ErrorController {
  constructor(private readonly errorService: ErrorService) {}

  @Get('/bad-request')
  @HttpCode(HttpStatus.BAD_REQUEST)
  async getBadRequest() {
    return this.errorService.getBadRequest();
  }

  @Get('/unauthorized')
  @HttpCode(HttpStatus.UNAUTHORIZED)
  async getUnauthorized() {
    return this.errorService.getUnauthorized();
  }

  @Get('/not-found')
  @HttpCode(HttpStatus.NOT_FOUND)
  async getNotFound() {
    return this.errorService.getNotFound();
  }

  @Get('/forbidden')
  @HttpCode(HttpStatus.FORBIDDEN)
  async getForbidden() {
    return this.errorService.getForbidden();
  }

  @Get('/conflict')
  @HttpCode(HttpStatus.CONFLICT)
  async getConflict() {
    return this.errorService.getConflict();
  }

  @Get('/internal-server-error')
  @HttpCode(HttpStatus.INTERNAL_SERVER_ERROR)
  async getInternalServerError() {
    return this.errorService.getInternalServerError();
  }

  @Get('/random')
  async getRandomError() {
    const error = await this.errorService.getRandomError();
    // 동적으로 상태 코드 설정을 위해서는 Response 객체를 사용해야 함
    // 하지만 여기서는 간단하게 500으로 고정
    throw new HttpException(error, error.statusCode);
  }
}
