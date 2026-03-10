# -----------------------------------------------------------------------------
# DOCUMENTATION ONLY
# Outputs describe the intended RDS contract without provisioning resources.
# -----------------------------------------------------------------------------

output "documentation_only" {
  description = "Confirms this module is documentation-only"
  value       = local.documentation_only
}

output "instance_identifier" {
  description = "Planned RDS instance identifier"
  value       = local.instance_identifier
}

output "subnet_group_name" {
  description = "Planned DB subnet group name"
  value       = local.subnet_group_name
}

output "security_group_id" {
  description = "Placeholder DB security group identifier"
  value       = local.security_group_id
}

output "database_name" {
  description = "Application database name"
  value       = var.database_name
}

output "db_username" {
  description = "Application database username"
  value       = var.db_username
}

output "architecture_summary" {
  description = "Concise summary of the intended RDS architecture"
  value       = local.architecture_summary
}
