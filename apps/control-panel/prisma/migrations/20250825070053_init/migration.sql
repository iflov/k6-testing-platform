-- CreateEnum
CREATE TYPE "public"."test_status" AS ENUM ('running', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "public"."test_runs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "test_id" VARCHAR(255) NOT NULL,
    "scenario" VARCHAR(100) NOT NULL,
    "vus" INTEGER NOT NULL,
    "duration" VARCHAR(50),
    "iterations" INTEGER,
    "execution_mode" VARCHAR(50) NOT NULL,
    "target_url" TEXT NOT NULL,
    "url_path" TEXT NOT NULL,
    "http_method" VARCHAR(10) NOT NULL,
    "request_body" JSONB,
    "status" "public"."test_status" NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."test_results" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "test_run_id" UUID NOT NULL,
    "total_requests" INTEGER NOT NULL,
    "failed_requests" INTEGER NOT NULL,
    "avg_response_time" DOUBLE PRECISION NOT NULL,
    "min_response_time" DOUBLE PRECISION NOT NULL,
    "max_response_time" DOUBLE PRECISION NOT NULL,
    "p95_response_time" DOUBLE PRECISION NOT NULL,
    "p99_response_time" DOUBLE PRECISION NOT NULL,
    "avg_request_rate" DOUBLE PRECISION NOT NULL,
    "error_rate" DOUBLE PRECISION NOT NULL,
    "data_received" BIGINT NOT NULL,
    "data_sent" BIGINT NOT NULL,
    "max_vus" INTEGER NOT NULL,
    "avg_iteration_duration" DOUBLE PRECISION,
    "metrics_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "test_runs_test_id_key" ON "public"."test_runs"("test_id");

-- CreateIndex
CREATE INDEX "idx_test_runs_started_at" ON "public"."test_runs"("started_at" DESC);

-- CreateIndex
CREATE INDEX "idx_test_runs_status" ON "public"."test_runs"("status");

-- CreateIndex
CREATE INDEX "idx_test_runs_test_id" ON "public"."test_runs"("test_id");

-- CreateIndex
CREATE UNIQUE INDEX "test_results_test_run_id_key" ON "public"."test_results"("test_run_id");

-- CreateIndex
CREATE INDEX "idx_test_results_test_run_id" ON "public"."test_results"("test_run_id");

-- AddForeignKey
ALTER TABLE "public"."test_results" ADD CONSTRAINT "FK_6fdd4b95d0420867b1a0c83a045" FOREIGN KEY ("test_run_id") REFERENCES "public"."test_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
