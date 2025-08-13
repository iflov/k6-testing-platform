-- Create UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for test status
CREATE TYPE test_status AS ENUM ('running', 'completed', 'failed', 'cancelled');

-- Create test_runs table
CREATE TABLE IF NOT EXISTS test_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_id VARCHAR(255) UNIQUE NOT NULL,
    scenario VARCHAR(100) NOT NULL,
    vus INTEGER NOT NULL,
    duration VARCHAR(50),
    iterations INTEGER,
    execution_mode VARCHAR(50) NOT NULL,
    target_url TEXT NOT NULL,
    url_path TEXT NOT NULL,
    http_method VARCHAR(10) NOT NULL,
    request_body JSONB,
    status test_status NOT NULL DEFAULT 'running',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create test_results table
CREATE TABLE IF NOT EXISTS test_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    test_run_id UUID NOT NULL REFERENCES test_runs(id) ON DELETE CASCADE,
    total_requests INTEGER NOT NULL,
    failed_requests INTEGER NOT NULL,
    avg_response_time DOUBLE PRECISION NOT NULL,
    min_response_time DOUBLE PRECISION NOT NULL,
    max_response_time DOUBLE PRECISION NOT NULL,
    p95_response_time DOUBLE PRECISION NOT NULL,
    p99_response_time DOUBLE PRECISION NOT NULL,
    avg_request_rate DOUBLE PRECISION NOT NULL,
    error_rate DOUBLE PRECISION NOT NULL,
    data_received BIGINT NOT NULL,
    data_sent BIGINT NOT NULL,
    max_vus INTEGER NOT NULL,
    avg_iteration_duration DOUBLE PRECISION,
    metrics_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_test_runs_test_id ON test_runs(test_id);
CREATE INDEX idx_test_runs_status ON test_runs(status);
CREATE INDEX idx_test_runs_started_at ON test_runs(started_at DESC);
CREATE INDEX idx_test_results_test_run_id ON test_results(test_run_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for test_runs
CREATE TRIGGER update_test_runs_updated_at BEFORE UPDATE
    ON test_runs FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO test_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO test_admin;