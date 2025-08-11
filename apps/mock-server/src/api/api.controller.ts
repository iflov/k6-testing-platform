import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiService } from './api.service';

@Controller('api')
export class ApiController {
  constructor(private readonly apiService: ApiService) {}

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.apiService.getUser(parseInt(id, 10));
  }

  @Get('users/:id/orders')
  getUserOrders(@Param('id') id: string) {
    return this.apiService.getUserOrders(parseInt(id, 10));
  }

  @Get('users/:id/cart')
  getUserCart(@Param('id') id: string) {
    return this.apiService.getUserCart(parseInt(id, 10));
  }

  @Get('users/:id/wishlist')
  getUserWishlist(@Param('id') id: string) {
    return this.apiService.getUserWishlist(parseInt(id, 10));
  }

  @Get('products')
  getProducts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('inStock') inStock?: string,
    @Query('minRating') minRating?: string,
    @Query('sort') sort?: string,
  ) {
    return this.apiService.getProducts({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      category,
      inStock: inStock === 'true',
      minRating: minRating ? parseFloat(minRating) : undefined,
      sort,
    });
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.apiService.getProduct(parseInt(id, 10));
  }

  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  createOrder(@Body() orderData: any) {
    return this.apiService.createOrder(orderData);
  }

  @Get('search')
  search(
    @Query('q') query: string,
    @Query('limit') limit?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('category') category?: string,
    @Query('sort') sort?: string,
  ) {
    return this.apiService.search({
      query,
      limit: limit ? parseInt(limit, 10) : 10,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      category,
      sort,
    });
  }

  @Get('reports/generate')
  generateReport(@Query('type') type: string, @Query('format') format: string) {
    return this.apiService.generateReport(type, format);
  }

  @Get('analytics/sales')
  getSalesAnalytics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('groupBy') groupBy: string,
  ) {
    return this.apiService.getSalesAnalytics(startDate, endDate, groupBy);
  }
}
