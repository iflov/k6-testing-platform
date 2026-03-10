#!/bin/sh
set -eu

echo "Ensuring PostgreSQL extension uuid-ossp exists..."
printf 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";' \
  | npx prisma db execute --stdin --schema prisma/schema.prisma

echo "Applying Prisma migrations..."
npx prisma migrate deploy
