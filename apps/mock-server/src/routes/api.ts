import { Router } from 'express';

export const apiRouter = Router();

// Mock data
const users = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  name: `User ${i + 1}`,
  email: `user${i + 1}@example.com`,
  createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
}));

const products = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: `Product ${i + 1}`,
  price: Math.floor(Math.random() * 1000) + 10,
  stock: Math.floor(Math.random() * 100),
}));

// Users endpoints
apiRouter.get('/users', (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;
  const start = (page - 1) * limit;
  const end = start + limit;

  res.json({
    data: users.slice(start, end),
    pagination: {
      page,
      limit,
      total: users.length,
      totalPages: Math.ceil(users.length / limit),
    },
  });
});

apiRouter.get('/users/:id', (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (user) {
    res.json(user);
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

apiRouter.post('/users', (req, res) => {
  const newUser = {
    id: users.length + 1,
    ...req.body,
    createdAt: new Date(),
  };
  users.push(newUser);
  res.status(201).json(newUser);
});

// Products endpoints
apiRouter.get('/products', (req, res) => {
  res.json(products);
});

apiRouter.get('/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (product) {
    res.json(product);
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});

// Orders endpoint (combines users and products)
apiRouter.post('/orders', (req, res) => {
  const { userId, productIds } = req.body;
  
  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(400).json({ error: 'Invalid user' });
  }

  const orderProducts = productIds
    ?.map((id: number) => products.find(p => p.id === id))
    .filter(Boolean);

  if (!orderProducts || orderProducts.length === 0) {
    return res.status(400).json({ error: 'Invalid products' });
  }

  const order = {
    id: Math.random().toString(36).substr(2, 9),
    userId,
    products: orderProducts,
    total: orderProducts.reduce((sum: number, p: any) => sum + p.price, 0),
    createdAt: new Date(),
  };

  res.status(201).json(order);
});

// Heavy computation endpoint (CPU intensive)
apiRouter.get('/heavy', (req, res) => {
  const iterations = parseInt(req.query.iterations as string) || 1000000;
  
  let result = 0;
  for (let i = 0; i < iterations; i++) {
    result += Math.sqrt(i);
  }

  res.json({
    message: 'Heavy computation completed',
    iterations,
    result,
  });
});

// Slow endpoint (simulates network latency)
apiRouter.get('/slow', async (req, res) => {
  const delay = parseInt(req.query.delay as string) || 2000;
  
  await new Promise(resolve => setTimeout(resolve, delay));
  
  res.json({
    message: 'Slow response',
    delay: `${delay}ms`,
  });
});