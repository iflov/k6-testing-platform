import { Injectable } from '@nestjs/common';

@Injectable()
export class ApiService {
  private mockUsers = this.generateMockUsers();
  private mockProducts = this.generateMockProducts();
  private orderIdCounter = 1000;

  private generateMockUsers() {
    const users = [];
    for (let i = 1; i <= 100; i++) {
      users.push({
        id: i,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        createdAt: new Date(
          Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000,
        ),
      });
    }
    return users;
  }

  private generateMockProducts() {
    const categories = ['electronics', 'clothing', 'books', 'home', 'sports'];
    const products = [];
    for (let i = 1; i <= 200; i++) {
      products.push({
        id: i,
        name: `Product ${i}`,
        price: Math.floor(Math.random() * 1000) + 10,
        category: categories[Math.floor(Math.random() * categories.length)],
        inStock: Math.random() > 0.2,
        rating: Math.random() * 5,
        description: `Description for product ${i}`,
      });
    }
    return products;
  }

  getUser(id: number) {
    const user = this.mockUsers.find((u) => u.id === id);
    return user || { id, name: `User ${id}`, email: `user${id}@example.com` };
  }

  getUserOrders(userId: number) {
    const orders = [];
    const orderCount = Math.floor(Math.random() * 10);
    for (let i = 0; i < orderCount; i++) {
      orders.push({
        id: `order_${userId}_${i}`,
        userId,
        productIds: [
          Math.floor(Math.random() * 50) + 1,
          Math.floor(Math.random() * 50) + 1,
        ],
        total: Math.floor(Math.random() * 500) + 50,
        status: ['pending', 'shipped', 'delivered'][
          Math.floor(Math.random() * 3)
        ],
        createdAt: new Date(
          Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
        ),
      });
    }
    return orders;
  }

  getUserCart(userId: number) {
    const items = [];
    const itemCount = Math.floor(Math.random() * 5);
    for (let i = 0; i < itemCount; i++) {
      const productId = Math.floor(Math.random() * 50) + 1;
      items.push({
        productId,
        quantity: Math.floor(Math.random() * 3) + 1,
        product: this.mockProducts.find((p) => p.id === productId),
      });
    }
    return {
      userId,
      items,
      total: items.reduce(
        (sum, item) => sum + (item.product?.price || 0) * item.quantity,
        0,
      ),
    };
  }

  getUserWishlist(userId: number) {
    const items = [];
    const itemCount = Math.floor(Math.random() * 10);
    const usedIds = new Set();
    for (let i = 0; i < itemCount; i++) {
      let productId;
      do {
        productId = Math.floor(Math.random() * 50) + 1;
      } while (usedIds.has(productId));
      usedIds.add(productId);
      items.push(this.mockProducts.find((p) => p.id === productId));
    }
    return items.filter(Boolean);
  }

  getProducts(filters: any) {
    let filtered = [...this.mockProducts];

    if (filters.category) {
      filtered = filtered.filter((p) => p.category === filters.category);
    }
    if (filters.inStock) {
      filtered = filtered.filter((p) => p.inStock);
    }
    if (filters.minRating) {
      filtered = filtered.filter((p) => p.rating >= filters.minRating);
    }

    if (filters.sort === 'price') {
      filtered.sort((a, b) => a.price - b.price);
    } else if (filters.sort === 'popularity') {
      filtered.sort((a, b) => b.rating - a.rating);
    }

    const start = (filters.page - 1) * filters.limit;
    const end = start + filters.limit;
    return filtered.slice(start, end);
  }

  getProduct(id: number) {
    const product = this.mockProducts.find((p) => p.id === id);
    return (
      product || {
        id,
        name: `Product ${id}`,
        price: Math.floor(Math.random() * 1000) + 10,
        category: 'electronics',
        inStock: true,
        rating: 4.5,
        description: `Description for product ${id}`,
      }
    );
  }

  createOrder(orderData: any) {
    const orderId = this.orderIdCounter++;
    return {
      id: orderId,
      userId: orderData.userId,
      productIds: orderData.productIds,
      quantities: orderData.quantities || [1],
      paymentMethod: orderData.paymentMethod || 'credit_card',
      shippingAddress: orderData.shippingAddress || {},
      totalAmount:
        orderData.totalAmount || Math.floor(Math.random() * 1000) + 100,
      status: 'pending',
      createdAt: new Date(),
    };
  }

  search(params: any) {
    let results = [...this.mockProducts];

    if (params.query) {
      const query = params.query.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query),
      );
    }

    if (params.minPrice) {
      results = results.filter((p) => p.price >= params.minPrice);
    }
    if (params.maxPrice) {
      results = results.filter((p) => p.price <= params.maxPrice);
    }
    if (params.category) {
      results = results.filter((p) => p.category === params.category);
    }

    if (params.sort === 'price') {
      results.sort((a, b) => a.price - b.price);
    }

    return results.slice(0, params.limit);
  }

  generateReport(type: string, format: string) {
    const reportData = {
      type,
      format,
      generatedAt: new Date(),
      data: {
        totalSales: Math.floor(Math.random() * 100000) + 10000,
        totalOrders: Math.floor(Math.random() * 1000) + 100,
        averageOrderValue: Math.floor(Math.random() * 500) + 50,
        topProducts: this.mockProducts.slice(0, 5),
      },
    };

    if (format === 'json') {
      return reportData;
    }

    return {
      ...reportData,
      message: `Report generated in ${format} format`,
    };
  }

  getSalesAnalytics(startDate: string, endDate: string, groupBy: string) {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    const analytics = [];
    if (groupBy === 'month') {
      for (let i = 0; i < 12; i++) {
        analytics.push({
          period: months[i],
          sales: Math.floor(Math.random() * 50000) + 10000,
          orders: Math.floor(Math.random() * 500) + 100,
          averageOrderValue: Math.floor(Math.random() * 200) + 50,
        });
      }
    } else {
      for (let i = 1; i <= 30; i++) {
        analytics.push({
          period: `Day ${i}`,
          sales: Math.floor(Math.random() * 5000) + 1000,
          orders: Math.floor(Math.random() * 50) + 10,
          averageOrderValue: Math.floor(Math.random() * 200) + 50,
        });
      }
    }

    return {
      startDate,
      endDate,
      groupBy,
      data: analytics,
    };
  }
}
