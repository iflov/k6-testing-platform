import { NextResponse } from "next/server";
import { Config } from "@/lib/config";

interface HealthCheckResponse {
  status: "healthy" | "unhealthy" | "degraded";
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
  environment?: string;
  dependencies?: Record<string, { status: string; message?: string }>;
}

export async function GET() {
  const config = Config.getInstance();

  // 실제 의존성 확인
  let dbReady = false;
  let k6RunnerReady = false;
  let mockServerReady = false;

  // DB 연결 확인
  if (process.env.DATABASE_URL) {
    try {
      // DB 연결 확인
      const { PrismaClient } = await import("@prisma/client");
      const prisma = new PrismaClient();
      await prisma.$queryRaw`SELECT 1`;
      await prisma.$disconnect();
      dbReady = true;
    } catch (error) {
      console.error("Database health check failed:", error);
    }
  }

  // K6 Runner 연결 확인
  try {
    const k6Response = await fetch(`${config.k6RunnerBaseUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    k6RunnerReady = k6Response.ok;
  } catch (error) {
    console.error("K6 Runner health check failed:", error);
  }

  // Mock Server 연결 확인
  try {
    const mockResponse = await fetch(`${config.mockServerUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    mockServerReady = mockResponse.ok;
  } catch (error) {
    console.error("Mock Server health check failed:", error);
  }

  const isReady =
    (!process.env.DATABASE_URL || dbReady) && k6RunnerReady && mockServerReady;

  const response: HealthCheckResponse = {
    status: isReady ? "healthy" : "unhealthy",
    service: "control-panel",
    version: process.env.npm_package_version || "1.0.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    dependencies: {
      database: {
        status: dbReady ? "healthy" : "unhealthy",
        message: dbReady ? "Connected" : "Connection failed",
      },
      k6Runner: {
        status: k6RunnerReady ? "healthy" : "unhealthy",
        message: k6RunnerReady ? "Connected" : "Connection failed",
      },
      mockServer: {
        status: mockServerReady ? "healthy" : "unhealthy",
        message: mockServerReady ? "Connected" : "Connection failed",
      },
    },
  };

  const statusCode = isReady ? 200 : 503;
  return NextResponse.json(response, { status: statusCode });
}
