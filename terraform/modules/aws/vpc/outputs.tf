# -----------------------------------------------------------------------------
# DOCUMENTATION ONLY
# Outputs describe the intended VPC contract without provisioning resources.
# -----------------------------------------------------------------------------

output "documentation_only" {
  description = "Confirms this module is documentation-only"
  value       = local.documentation_only
}

output "vpc_name" {
  description = "Planned AWS VPC name"
  value       = local.vpc_name
}

output "vpc_id" {
  description = "Placeholder VPC identifier for downstream module wiring"
  value       = "doc-${local.vpc_name}"
}

output "private_subnet_ids" {
  description = "Placeholder private subnet IDs for EKS and RDS planning"
  value       = local.private_subnet_ids
}

output "public_subnet_ids" {
  description = "Placeholder public subnet IDs for ingress planning"
  value       = local.public_subnet_ids
}

output "eks_subnet_ids" {
  description = "Private subnets intended for EKS node groups"
  value       = local.eks_subnet_ids
}

output "architecture_summary" {
  description = "Concise summary of the intended VPC architecture"
  value       = local.architecture_summary
}
