import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { TestRun } from '../entities/TestRun.entity';
import { TestResult } from '../entities/TestResult.entity';

let dataSource: DataSource | null = null;

// Database configuration for Next.js serverless environment
const createDataSource = () => {
  // Environment-based configuration
  const isProduction = process.env.NODE_ENV === 'production';
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Docker 환경에서는 postgres 서비스명 사용, 로컬에서는 localhost
  const host = process.env.DB_HOST || 'postgres';
  
  return new DataSource({
    type: 'postgres',
    host: host,
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USER || 'test_admin',
    password: process.env.DB_PASSWORD || 'TestToTheMoon101!',
    database: process.env.DB_NAME || 'Test',
    entities: [TestRun, TestResult],
    synchronize: isDevelopment, // Only in development
    logging: isDevelopment ? ['error', 'warn'] : ['error'],
    // Connection pool settings for serverless
    extra: {
      max: 10, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
    },
    ...(isProduction && {
      ssl: {
        rejectUnauthorized: false, // For AWS RDS
      },
    }),
  });
};

// Get or create database connection
export const getDataSource = async (): Promise<DataSource> => {
  if (!dataSource || !dataSource.isInitialized) {
    dataSource = createDataSource();
    
    try {
      await dataSource.initialize();
      console.log('Database connection initialized');
    } catch (error) {
      console.error('Error initializing database connection:', error);
      dataSource = null;
      throw error;
    }
  }
  
  return dataSource;
};

// Close database connection (for cleanup)
export const closeDataSource = async (): Promise<void> => {
  if (dataSource && dataSource.isInitialized) {
    await dataSource.destroy();
    dataSource = null;
    console.log('Database connection closed');
  }
};

// Repository getters
export const getTestRunRepository = async () => {
  const ds = await getDataSource();
  return ds.getRepository(TestRun);
};

export const getTestResultRepository = async () => {
  const ds = await getDataSource();
  return ds.getRepository(TestResult);
};