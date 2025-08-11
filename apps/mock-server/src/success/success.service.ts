import { Injectable } from '@nestjs/common';

@Injectable()
export class SuccessService {
  constructor() {}

  async getSuccess() {
    return {
      statusCode: 200,
      error: false,
      message: 'ok',
    };
  }
}
