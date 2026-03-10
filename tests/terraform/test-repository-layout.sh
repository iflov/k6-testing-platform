#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

terraform fmt -check -recursive "$ROOT_DIR/terraform" >/dev/null

for dir in \
  "$ROOT_DIR/terraform/modules/aws/vpc" \
  "$ROOT_DIR/terraform/modules/aws/eks" \
  "$ROOT_DIR/terraform/modules/aws/rds" \
  "$ROOT_DIR/terraform/modules/aws/ec2-influxdb" \
  "$ROOT_DIR/terraform/environments/aws-dev"; do
  [[ -d "$dir" ]] || { echo "❌ Missing Terraform directory: $dir" >&2; exit 1; }
done

grep -R -q 'DOCUMENTATION ONLY' "$ROOT_DIR/terraform/modules/aws"

echo "✅ Terraform repository layout and formatting checks passed"
