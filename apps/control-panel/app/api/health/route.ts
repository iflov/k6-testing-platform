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

  // TODO 환경변수 가져오는걸 Config에서 가져와야함.
  // TODO 여기서 version은 npm package version이 아니라 App version이 되어야함.
  // TODO config로 import 해오는걸로 통일해야함 ( { Config } 말고 )
  // ? npm_package_version으로 앱버전을 사용할수 있을지도?
  const response: HealthCheckResponse = {
    status: "healthy",
    service: "control-panel",
    version: process.env.npm_package_version || "1.0.0",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.environment || "development",
    dependencies: {
      database: {
        status: process.env.DATABASE_URL ? "healthy" : "unhealthy",
        message: process.env.DATABASE_URL ? "Configured" : "Not configured",
      },
      k6Runner: {
        status: config.k6RunnerBaseUrl ? "healthy" : "unhealthy",
        message: config.k6RunnerBaseUrl ? "Configured" : "Not configured",
      },
      mockServer: {
        status: process.env.MOCK_SERVER_URL ? "healthy" : "unhealthy",
        message: process.env.MOCK_SERVER_URL ? "Configured" : "Not configured",
      },
    },
  };

  return NextResponse.json(response);
}
