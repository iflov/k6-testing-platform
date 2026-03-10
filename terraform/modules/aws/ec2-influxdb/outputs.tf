# -----------------------------------------------------------------------------
# DOCUMENTATION ONLY
# Outputs describe the intended EC2-hosted InfluxDB contract without provisioning resources.
# -----------------------------------------------------------------------------

output "documentation_only" {
  description = "Confirms this module is documentation-only"
  value       = local.documentation_only
}

output "instance_name" {
  description = "Planned EC2 instance name"
  value       = local.instance_name
}

output "security_group_id" {
  description = "Placeholder security group identifier for InfluxDB access"
  value       = local.security_group_id
}

output "iam_role_name" {
  description = "Planned IAM role name for EC2 instance access"
  value       = local.iam_role_name
}

output "service_url" {
  description = "Placeholder internal service URL used for application planning"
  value       = "http://${local.instance_name}.doc.internal:${var.service_port}"
}

output "architecture_summary" {
  description = "Concise summary of the intended EC2-hosted InfluxDB architecture"
  value       = local.architecture_summary
}
