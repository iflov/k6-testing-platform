# -----------------------------------------------------------------------------
# DOCUMENTATION ONLY
# This module captures the intended EKS cluster interface and operational shape.
# It does not create an AWS provider dependency or any infrastructure.
# -----------------------------------------------------------------------------

locals {
  documentation_only = true

  cluster_name        = "${var.environment}-${var.project_name}-eks"
  node_group_name     = "${var.environment}-${var.project_name}-system"
  oidc_provider_name  = "doc-${local.cluster_name}-oidc"
  node_security_group = "doc-${local.cluster_name}-nodes-sg"

  architecture_summary = {
    kubernetes_version  = var.kubernetes_version
    endpoint_access     = var.endpoint_access
    node_instance_types = var.node_instance_types
    desired_nodes       = var.desired_node_count
    scaling_bounds = {
      min = var.min_node_count
      max = var.max_node_count
    }
    addons = var.cluster_addons
  }
}
