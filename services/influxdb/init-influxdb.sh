#!/bin/bash

# Wait for InfluxDB to be ready
echo "Waiting for InfluxDB to be ready..."
until influx -execute "SHOW DATABASES" > /dev/null 2>&1; do
  echo "InfluxDB is not ready yet..."
  sleep 2
done

echo "InfluxDB is ready!"

# Check if k6 database exists
DB_EXISTS=$(influx -execute "SHOW DATABASES" | grep -c "k6")

if [ "$DB_EXISTS" -eq "0" ]; then
  echo "Creating k6 database..."
  influx -execute "CREATE DATABASE k6"
  echo "k6 database created successfully!"
else
  echo "k6 database already exists."
fi

# Create retention policy (optional - keeps data for 30 days)
echo "Setting up retention policy..."
influx -execute "CREATE RETENTION POLICY \"k6_policy\" ON \"k6\" DURATION 30d REPLICATION 1 DEFAULT" 2>/dev/null || echo "Retention policy already exists or updated."

echo "InfluxDB initialization complete!"