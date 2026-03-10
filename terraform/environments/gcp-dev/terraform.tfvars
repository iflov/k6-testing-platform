# ----------------------------------------------------------------------------
# gcp-dev environment — Terraform variable values
#
# Replace <YOUR_GCP_PROJECT_ID> with your actual GCP project ID before running.
# For sensitive values (db_password) prefer:
#   export TF_VAR_db_password="..."
# or use a secrets backend rather than committing values here.
# ----------------------------------------------------------------------------

project_id   = "<YOUR_GCP_PROJECT_ID>"
project_name = "k6platform"
region       = "asia-northeast3"
zone         = "asia-northeast3-a"
environment  = "dev"

# GKE
gke_machine_type  = "e2-medium"
gke_min_nodes     = 1
gke_max_nodes     = 3
gke_initial_nodes = 1

# Cloud SQL
cloudsql_tier = "db-f1-micro"
# db_password = set via TF_VAR_db_password environment variable
