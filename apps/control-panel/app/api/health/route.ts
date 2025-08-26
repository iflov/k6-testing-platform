import { NextResponse } from "next/server";
import config from "@/lib/config";

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
  const response: HealthCheckResponse = {
    status: "healthy",
    service: "control-panel",
    version: config.appVersion,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.environment || "development",
    dependencies: {
      database: {
        status: config.databaseUrl ? "healthy" : "unhealthy",
        message: config.databaseUrl ? "Configured" : "Not configured",
      },
      k6Runner: {
        status: config.k6RunnerBaseUrl ? "healthy" : "unhealthy",
        message: config.k6RunnerBaseUrl ? "Configured" : "Not configured",
      },
      mockServer: {
        status: config.mockServerUrl ? "healthy" : "unhealthy",
        message: config.mockServerUrl ? "Configured" : "Not configured",
      },
    },
  };

  return NextResponse.json(response);
}
