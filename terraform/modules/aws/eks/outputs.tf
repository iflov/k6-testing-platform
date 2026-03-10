# -----------------------------------------------------------------------------
# DOCUMENTATION ONLY
# Outputs describe the intended EKS contract without provisioning resources.
# -----------------------------------------------------------------------------

output "documentation_only" {
  description = "Confirms this module is documentation-only"
  value       = local.documentation_only
}

output "cluster_name" {
  description = "Planned EKS cluster name"
  value       = local.cluster_name
}

output "cluster_endpoint" {
  description = "Placeholder endpoint for documentation and downstream references"
  value       = "https://${local.cluster_name}.doc.internal"
}

output "cluster_oidc_provider" {
  description = "Placeholder OIDC provider identifier for IRSA planning"
  value       = local.oidc_provider_name
}

output "node_group_name" {
  description = "Planned default managed node group name"
  value       = local.node_group_name
}

output "node_security_group_id" {
  description = "Placeholder node security group identifier"
  value       = local.node_security_group
}

output "architecture_summary" {
  description = "Concise summary of the intended EKS architecture"
  value       = local.architecture_summary
}
