# -----------------------------------------------------------------------------
# DOCUMENTATION ONLY
# Remote state is intentionally left commented because this slice is for design
# review only. Uncomment and populate once the AWS implementation is approved.
# -----------------------------------------------------------------------------

# terraform {
#   backend "s3" {
#     bucket         = "<YOUR_TERRAFORM_STATE_BUCKET>"
#     key            = "terraform/aws-dev/terraform.tfstate"
#     region         = "ap-northeast-2"
#     dynamodb_table = "<YOUR_TERRAFORM_LOCK_TABLE>"
#     encrypt        = true
#   }
# }
