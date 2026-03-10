# ----------------------------------------------------------------------------
# Remote GCS backend for Terraform state
#
# Uncomment and populate the block below before running `terraform init` in a
# shared / CI environment.  A GCS bucket must exist before initialisation:
#
#   gsutil mb -p <PROJECT_ID> -l asia-northeast3 gs://<BUCKET_NAME>
#   gsutil versioning set on gs://<BUCKET_NAME>
#
# Then run:
#   terraform init \
#     -backend-config="bucket=<BUCKET_NAME>" \
#     -backend-config="prefix=terraform/gcp-dev"
# ----------------------------------------------------------------------------

# terraform {
#   backend "gcs" {
#     bucket = "<YOUR_STATE_BUCKET_NAME>"   # e.g. "my-project-tf-state"
#     prefix = "terraform/gcp-dev"          # path inside the bucket
#   }
# }
