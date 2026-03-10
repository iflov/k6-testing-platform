# AWS Terraform slice: cost and multi-cloud notes

## DOCUMENTATION ONLY
This note exists to explain why the AWS Terraform slice is intentionally provider-free and how it compares with the existing GCP-first layout.

## Cost comparison (dev-sized assumptions)
- **VPC / networking:** AWS typically adds more explicit line items than GCP for a small dev footprint because NAT Gateway hours and data processing are separate costs; the documented slice therefore defaults to `nat_gateway_mode = "single"` for cost containment.
- **Kubernetes:** EKS usually has a higher fixed control-plane cost than GKE Autopilot-style or small Standard clusters, so the AWS slice keeps node counts conservative and assumes only core addons.
- **Postgres:** RDS PostgreSQL and Cloud SQL PostgreSQL are operationally similar for dev, but AWS pricing often shifts faster once Multi-AZ or higher IOPS storage is enabled.
- **InfluxDB host:** EC2 and GCE are close for a single small VM; the larger tradeoff is operational ownership of patching, storage growth, and backup design.

## Multi-cloud tradeoffs
- **AWS strengths:** deeper IAM/IRSA patterns around EKS, broader instance-family choice, and tighter integration if the rest of the platform already runs on AWS.
- **GCP strengths:** simpler private-cluster ergonomics, easier baseline networking for small teams, and often less overhead for a compact dev/test platform.
- **Why this slice is docs-only:** it lets the team review naming, interfaces, and rough cost posture before deciding whether AWS should become a peer environment or remain a future option.
