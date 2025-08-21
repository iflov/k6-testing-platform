#!/bin/bash

echo "=========================================="
echo "InfluxDB 3.x Core Initialization Script"
echo "=========================================="

# Configuration
INFLUXDB_HOST="${INFLUXDB_HOST:-influxdb}"
INFLUXDB_PORT="${INFLUXDB_PORT:-8086}"
INFLUXDB_URL="http://${INFLUXDB_HOST}:${INFLUXDB_PORT}"
INFLUXDB_TOKEN="${INFLUXDB_TOKEN:-dev-token-for-testing}"
INFLUXDB_ORG="${INFLUXDB_ORG:-k6org}"
INFLUXDB_BUCKET="${INFLUXDB_BUCKET:-k6}"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check InfluxDB health
check_health() {
  curl -s "${INFLUXDB_URL}/health" > /dev/null 2>&1
  return $?
}

# Function to check if bucket exists
check_bucket() {
  response=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Token ${INFLUXDB_TOKEN}" \
    "${INFLUXDB_URL}/api/v2/buckets?org=${INFLUXDB_ORG}&name=${INFLUXDB_BUCKET}")
  
  if [ "$response" = "200" ]; then
    return 0
  else
    return 1
  fi
}

# Function to create bucket
create_bucket() {
  echo -e "${YELLOW}Creating bucket '${INFLUXDB_BUCKET}'...${NC}"
  
  response=$(curl -s -X POST \
    -H "Authorization: Token ${INFLUXDB_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"${INFLUXDB_BUCKET}\",
      \"orgID\": \"${INFLUXDB_ORG}\",
      \"retentionRules\": [
        {
          \"type\": \"expire\",
          \"everySeconds\": 2592000
        }
      ]
    }" \
    "${INFLUXDB_URL}/api/v2/buckets")
  
  if echo "$response" | grep -q "error"; then
    echo -e "${RED}Failed to create bucket: $response${NC}"
    return 1
  else
    echo -e "${GREEN}Bucket '${INFLUXDB_BUCKET}' created successfully!${NC}"
    return 0
  fi
}

# Wait for InfluxDB to be ready
echo "Waiting for InfluxDB 3.x to be ready..."
retry_count=0
max_retries=30

while [ $retry_count -lt $max_retries ]; do
  if check_health; then
    echo -e "${GREEN}InfluxDB 3.x is ready!${NC}"
    break
  fi
  
  echo "InfluxDB 3.x is not ready yet... (attempt $((retry_count + 1))/$max_retries)"
  sleep 2
  retry_count=$((retry_count + 1))
done

if [ $retry_count -eq $max_retries ]; then
  echo -e "${RED}InfluxDB 3.x failed to start after $max_retries attempts${NC}"
  exit 1
fi

# Verify InfluxDB 3.x API endpoints
echo "Verifying InfluxDB 3.x API endpoints..."

# Check write endpoint
write_check=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  "${INFLUXDB_URL}/api/v2/write?org=${INFLUXDB_ORG}&bucket=${INFLUXDB_BUCKET}")

if [ "$write_check" = "204" ] || [ "$write_check" = "400" ]; then
  echo -e "${GREEN}✓ Write endpoint is accessible${NC}"
else
  echo -e "${YELLOW}⚠ Write endpoint returned: $write_check${NC}"
fi

# Check query endpoint
query_check=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Token ${INFLUXDB_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"SELECT 1\", \"type\": \"sql\"}" \
  "${INFLUXDB_URL}/api/v2/query")

if [ "$query_check" = "200" ] || [ "$query_check" = "400" ]; then
  echo -e "${GREEN}✓ Query endpoint is accessible${NC}"
else
  echo -e "${YELLOW}⚠ Query endpoint returned: $query_check${NC}"
fi

# Display configuration
echo ""
echo "=========================================="
echo "InfluxDB 3.x Configuration:"
echo "=========================================="
echo -e "URL:          ${GREEN}${INFLUXDB_URL}${NC}"
echo -e "Organization: ${GREEN}${INFLUXDB_ORG}${NC}"
echo -e "Bucket:       ${GREEN}${INFLUXDB_BUCKET}${NC}"
echo -e "Token:        ${GREEN}[CONFIGURED]${NC}"
echo "=========================================="

# Display API endpoints for reference
echo ""
echo "API Endpoints:"
echo "----------------------------------------"
echo "Health:  GET  ${INFLUXDB_URL}/health"
echo "Write:   POST ${INFLUXDB_URL}/api/v2/write?org=${INFLUXDB_ORG}&bucket=${INFLUXDB_BUCKET}"
echo "Query:   POST ${INFLUXDB_URL}/api/v2/query?org=${INFLUXDB_ORG}"
echo "=========================================="

# Note about InfluxDB 3.x Core
echo ""
echo -e "${YELLOW}Note: InfluxDB 3.x Core Features:${NC}"
echo "• Apache Arrow and Parquet for data storage"
echo "• SQL query support via FlightSQL"
echo "• Token-based authentication"
echo "• Compatible with xk6-output-influxdb extension"
echo "=========================================="

echo -e "${GREEN}InfluxDB 3.x initialization complete!${NC}"