# -----------------------------------------------------------------------------
# DOCUMENTATION ONLY
# Outputs provide a readable snapshot of the planned AWS dev topology.
# -----------------------------------------------------------------------------

output "documentation_only" {
  description = "Confirms the aws-dev environment is documentation-only"
  value       = true
}

output "aws_dev_topology" {
  description = "Concise snapshot of the planned AWS dev topology"
  value = {
    vpc          = module.vpc.architecture_summary
    eks          = module.eks.architecture_summary
    rds          = module.rds.architecture_summary
    ec2_influxdb = module.ec2_influxdb.architecture_summary
  }
}
