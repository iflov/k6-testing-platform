#!/bin/bash

# Check if authentication is enabled
if [ "$INFLUXDB_HTTP_AUTH_ENABLED" = "true" ]; then
  echo "Authentication is enabled. Checking for admin user..."
  
  # First, try to connect without credentials to check if admin exists
  if influx -execute "SHOW USERS" 2>&1 | grep -q "error authorizing query: create admin user first"; then
    echo "Admin user does not exist. Creating admin user..."
    influx -execute "CREATE USER ${INFLUXDB_ADMIN_USER:-admin} WITH PASSWORD '${INFLUXDB_ADMIN_PASSWORD:-admin}' WITH ALL PRIVILEGES"
    echo "Admin user created successfully!"
  fi
  
  # Now use credentials for all subsequent commands
  INFLUX_CMD="influx -username ${INFLUXDB_ADMIN_USER:-admin} -password ${INFLUXDB_ADMIN_PASSWORD:-admin}"
else
  echo "Authentication is disabled. Running without credentials..."
  INFLUX_CMD="influx"
fi

# Wait for InfluxDB to be ready
echo "Waiting for InfluxDB to be ready..."
until $INFLUX_CMD -execute "SHOW DATABASES" > /dev/null 2>&1; do
  echo "InfluxDB is not ready yet..."
  sleep 2
done

echo "InfluxDB is ready!"

# Check if k6 database exists
DB_EXISTS=$($INFLUX_CMD -execute "SHOW DATABASES" | grep -c "k6")

if [ "$DB_EXISTS" -eq "0" ]; then
  echo "Creating k6 database..."
  $INFLUX_CMD -execute "CREATE DATABASE k6"
  echo "k6 database created successfully!"
else
  echo "k6 database already exists."
fi

# Create retention policy (optional - keeps data for 30 days)
echo "Setting up retention policy..."
$INFLUX_CMD -execute "CREATE RETENTION POLICY \"k6_policy\" ON \"k6\" DURATION 30d REPLICATION 1 DEFAULT" 2>/dev/null || echo "Retention policy already exists or updated."

# If authentication is enabled, create k6 user
if [ "$INFLUXDB_HTTP_AUTH_ENABLED" = "true" ] && [ -n "$INFLUXDB_USER" ] && [ -n "$INFLUXDB_USER_PASSWORD" ]; then
  echo "Creating k6 user..."
  $INFLUX_CMD -execute "CREATE USER ${INFLUXDB_USER} WITH PASSWORD '${INFLUXDB_USER_PASSWORD}'" 2>/dev/null || echo "User already exists."
  $INFLUX_CMD -execute "GRANT ALL ON k6 TO ${INFLUXDB_USER}" 2>/dev/null || echo "Permissions already granted."
fi

echo "InfluxDB initialization complete!"