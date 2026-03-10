# -----------------------------------------------------------------------------
# DOCUMENTATION ONLY
# This module intentionally creates no AWS resources.
# It captures the planned VPC shape, naming, and interface for a future AWS
# implementation while keeping Terraform validation local and provider-free.
# -----------------------------------------------------------------------------

locals {
  documentation_only = true

  vpc_name           = "${var.environment}-${var.project_name}-vpc"
  private_subnet_ids = [for az in var.availability_zones : "doc-${replace(az, "-", "")}-private"]
  public_subnet_ids  = [for az in var.availability_zones : "doc-${replace(az, "-", "")}-public"]
  eks_subnet_ids     = local.private_subnet_ids

  architecture_summary = {
    cidr_block           = var.vpc_cidr
    availability_zones   = var.availability_zones
    private_subnet_cidrs = var.private_subnet_cidrs
    public_subnet_cidrs  = var.public_subnet_cidrs
    nat_gateway_mode     = var.nat_gateway_mode
    endpoint_strategy    = var.vpc_endpoint_strategy
  }
}
