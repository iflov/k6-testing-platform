#!/bin/bash

# K6 Test Runner with Web Dashboard
# Usage: ./run-test-with-dashboard.sh [test-file] [vus] [duration] [target-url]
# Web Dashboard will be available at http://localhost:5665

TEST_FILE=${1:-"simple-load-test.js"}
VUS=${2:-10}
DURATION=${3:-"1m"}
TARGET_URL=${4:-"http://mock-server:3001"}
REPORT_NAME="test-report-$(date +%Y%m%d-%H%M%S).html"

echo "====================================="
echo "K6 Load Test with Web Dashboard"
echo "====================================="
echo "Test File: $TEST_FILE"
echo "Virtual Users: $VUS"
echo "Duration: $DURATION"
echo "Target URL: $TARGET_URL"
echo "Dashboard: http://localhost:5665"
echo "HTML Report: ./reports/$REPORT_NAME"
echo "====================================="
echo ""

# Create reports directory if it doesn't exist
mkdir -p reports

# Check if port 5665 is already in use
if lsof -Pi :5665 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Warning: Port 5665 is already in use. Dashboard may not be accessible."
    echo "   Please close any existing k6 tests or use a different port."
    echo ""
fi

echo "Starting K6 test with Web Dashboard..."
echo "➡️  Open http://localhost:5665 in your browser to view real-time metrics"
echo ""

# Run K6 test with Web Dashboard
docker run --rm -it \
  --network k6-testing-platform_k6-network \
  -p 5665:5665 \
  -e VUS=$VUS \
  -e DURATION=$DURATION \
  -e TARGET_URL=$TARGET_URL \
  -e K6_WEB_DASHBOARD=true \
  -e K6_WEB_DASHBOARD_HOST=0.0.0.0 \
  -e K6_WEB_DASHBOARD_PORT=5665 \
  -e K6_WEB_DASHBOARD_PERIOD=1s \
  -e K6_WEB_DASHBOARD_EXPORT=/reports/$REPORT_NAME \
  -v $(pwd)/k6-scripts:/scripts:ro \
  -v $(pwd)/reports:/reports \
  grafana/k6:latest run \
  --out influxdb=http://influxdb:8086/k6 \
  --out web-dashboard \
  /scripts/scenarios/$TEST_FILE

echo ""
echo "====================================="
echo "Test completed!"
echo "HTML Report saved to: ./reports/$REPORT_NAME"
echo "View metrics in InfluxDB at: http://localhost:8086"
echo "====================================="
echo ""
echo "💡 Tip: The k6 process continues running while dashboard windows are open."
echo "   Close all browser tabs viewing the dashboard to fully stop the test."