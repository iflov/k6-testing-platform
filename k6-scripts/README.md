# K6 Test Scenarios Documentation

## Overview
This directory contains comprehensive k6 performance test scenarios for load testing and system stability validation.

## Test Scenarios

### 1. Smoke Test (`smoke-test.js`)
**Purpose**: Validate that the system works under minimal load and test scripts are functioning correctly.

**Key Characteristics**:
- Duration: 1 minute
- Virtual Users: 1 VU
- Use Case: Initial validation, script verification
- Success Criteria: 
  - 99% requests < 1 second
  - Error rate < 1%

**When to Use**:
- Before running larger tests
- After deployment
- Script validation

### 2. Load Test (`load-test.js`)
**Purpose**: Measure system performance under expected normal load conditions.

**Key Characteristics**:
- Duration: 9 minutes (2m ramp-up, 5m sustained, 2m ramp-down)
- Virtual Users: 20 VUs
- Use Case: Regular performance validation
- Traffic Distribution:
  - 35% Product browsing
  - 25% User activities
  - 20% Purchase flow
  - 15% Search operations
  - 5% Health checks
- Success Criteria:
  - P95 < 800ms, P99 < 1500ms
  - Error rate < 5%
  - 100+ successful orders

**When to Use**:
- Regular performance testing
- Pre-release validation
- Capacity planning

### 3. Stress Test (`stress-test.js`)
**Purpose**: Find the system's breaking point and understand how it degrades under extreme load.

**Key Characteristics**:
- Duration: 25 minutes with progressive load increase
- Virtual Users: Up to 300 VUs
- Use Case: Capacity limit testing
- Traffic Types:
  - Heavy read operations (batch requests)
  - Heavy write operations (multiple orders)
  - Complex queries with filters
  - Database-intensive operations
  - Concurrent user operations
- Success Criteria:
  - P90 < 2 seconds (relaxed for stress)
  - Error rate < 20%
  - Identifies breaking point

**When to Use**:
- Capacity planning
- Understanding system limits
- Preparing for unexpected traffic

### 4. Spike Test (`spike-test.js`)
**Purpose**: Test system's ability to handle sudden traffic spikes and recovery.

**Key Characteristics**:
- Duration: ~13 minutes with multiple spikes
- Virtual Users: 10 → 200 → 10 → 300 → 10
- Use Case: Flash sale, viral content, DDoS simulation
- Spike Patterns:
  - First spike: 200 VUs for 3 minutes
  - Second spike: 300 VUs for 2 minutes
- Focus Areas:
  - Critical path operations (must work)
  - Graceful degradation for non-critical
  - Recovery time measurement
- Success Criteria:
  - P95 < 2 seconds during spike
  - Error rate < 15%
  - Recovery time < 5 seconds average

**When to Use**:
- Before marketing campaigns
- Testing auto-scaling
- Incident preparedness

### 5. Soak Test (`soak-test.js`)
**Purpose**: Detect memory leaks, resource exhaustion, and performance degradation over extended periods.

**Key Characteristics**:
- Duration: 4+ hours
- Virtual Users: 30-50 VUs sustained
- Use Case: Long-term stability validation
- Monitoring Focus:
  - Memory usage trends
  - Response time degradation
  - Connection pool exhaustion
  - Resource leaks
- Traffic Patterns:
  - Simulates business hours vs off-hours
  - Peak time simulation (lunch, afternoon)
- Success Criteria:
  - P95 < 1.5 seconds, P99 < 3 seconds
  - Error rate < 2%
  - Response time degradation < 200ms average
  - No resource exhaustion events

**When to Use**:
- Before major releases
- Validating fixes for memory leaks
- Production readiness testing

## Running Tests

### Basic Execution
```bash
# Run directly with Docker
docker run --rm \
  --network k6-testing-platform_k6-network \
  -v $(pwd):/scripts:ro \
  grafana/k6:latest run /scripts/scenarios/[test-name].js \
  --out influxdb=http://influxdb:8086/k6

# With environment variables
docker run --rm \
  --network k6-testing-platform_k6-network \
  -e TARGET_URL=http://mock-server:3001 \
  -e VUS=10 \
  -e DURATION=5m \
  -v $(pwd):/scripts:ro \
  grafana/k6:latest run /scripts/scenarios/load-test.js \
  --out influxdb=http://influxdb:8086/k6
```

### Using Control Panel
Navigate to http://localhost:3000 and use the web interface to:
- Select test scenario
- Configure VUs and duration
- Start/stop tests
- View real-time results

### Monitoring Results
1. **Chronograf** (http://localhost:8888):
   - Real-time metrics visualization
   - Custom dashboards for each test type
   - Historical data analysis

2. **InfluxDB Queries**:
   ```sql
   -- View recent requests
   SELECT mean("value") FROM "http_req_duration" 
   WHERE time > now() - 5m 
   GROUP BY time(10s)
   
   -- Check error rates
   SELECT sum("value") FROM "errors" 
   WHERE time > now() - 5m
   ```

## Test Selection Guide

| Scenario | Frequency | Duration | Purpose |
|----------|-----------|----------|---------|
| Smoke | Every deployment | 1 min | Basic validation |
| Load | Daily/Weekly | 10 min | Performance baseline |
| Stress | Monthly | 25 min | Capacity planning |
| Spike | Before campaigns | 15 min | Spike readiness |
| Soak | Quarterly | 4+ hours | Stability validation |

## Metrics Interpretation

### Key Metrics
- **http_req_duration**: Response time (aim for P95 < 1s)
- **http_req_failed**: Failed request rate (aim for < 1%)
- **errors**: Custom error tracking
- **vus**: Active virtual users
- **iterations**: Completed test iterations

### Custom Metrics
- **successful_orders**: Order completion tracking
- **spike_errors**: Errors during spike periods
- **recovery_time**: Time to recover from spikes
- **response_time_degradation**: Performance degradation over time
- **resource_exhaustion**: Resource limit hits

## Best Practices

1. **Test Progression**: Always run Smoke → Load → Stress → Spike → Soak
2. **Baseline First**: Establish performance baselines before testing changes
3. **Monitor Resources**: Watch CPU, memory, and database during tests
4. **Document Results**: Keep records of test results for trend analysis
5. **Realistic Data**: Use realistic data volumes and patterns
6. **Clean Environment**: Reset test data between runs for consistency

## Troubleshooting

### Common Issues
1. **Connection Refused**: Check if services are running and network is correct
2. **High Error Rate**: Review application logs and database connections
3. **Timeouts**: Check resource limits and scaling settings
4. **Inconsistent Results**: Ensure clean test environment and stable network

### Debug Commands
```bash
# Check container logs
docker-compose logs [service-name]

# Monitor real-time metrics
docker stats

# Check InfluxDB data
docker exec influxdb influx -execute "SHOW MEASUREMENTS" -database k6

# View k6 test output
docker logs k6-test-[id]
```

## Contributing
When adding new test scenarios:
1. Follow existing naming conventions
2. Include comprehensive comments
3. Define clear success criteria
4. Update this documentation
5. Test in isolation first