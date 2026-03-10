# -----------------------------------------------------------------------------
# DOCUMENTATION ONLY
# This module documents the intended AWS RDS PostgreSQL shape and interfaces.
# It is provider-free and creates no infrastructure.
# -----------------------------------------------------------------------------

locals {
  documentation_only = true

  instance_identifier = "${var.environment}-${var.project_name}-postgres"
  subnet_group_name   = "${var.environment}-${var.project_name}-db-subnets"
  security_group_id   = "doc-${var.environment}-${var.project_name}-rds-sg"

  architecture_summary = {
    engine                = var.engine
    engine_version        = var.engine_version
    instance_class        = var.instance_class
    allocated_storage_gb  = var.allocated_storage_gb
    multi_az              = var.multi_az
    backup_retention_days = var.backup_retention_days
    storage_type          = var.storage_type
  }
}
