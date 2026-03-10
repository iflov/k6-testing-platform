# -----------------------------------------------------------------------------
# DOCUMENTATION ONLY
# Variables define the intended AWS EKS interface for later implementation.
# -----------------------------------------------------------------------------

variable "project_name" {
  description = "Short name used for resource naming"
  type        = string
  default     = "k6platform"
}

variable "environment" {
  description = "Deployment environment label"
  type        = string
}

variable "region" {
  description = "AWS region for the EKS design"
  type        = string
  default     = "ap-northeast-2"
}

variable "vpc_id" {
  description = "Planned VPC identifier passed from the VPC module"
  type        = string
}

variable "subnet_ids" {
  description = "Private subnet IDs intended for EKS control plane ENIs and worker nodes"
  type        = list(string)
}

variable "kubernetes_version" {
  description = "Target Kubernetes version for the AWS EKS cluster"
  type        = string
  default     = "1.31"
}

variable "endpoint_access" {
  description = "Control plane endpoint posture: private, public, or public-and-private"
  type        = string
  default     = "private"
}

variable "node_instance_types" {
  description = "Planned EC2 instance types for the primary managed node group"
  type        = list(string)
  default     = ["t3.large"]
}

variable "desired_node_count" {
  description = "Desired worker node count for the default node group"
  type        = number
  default     = 2
}

variable "min_node_count" {
  description = "Minimum worker node count for autoscaling"
  type        = number
  default     = 1
}

variable "max_node_count" {
  description = "Maximum worker node count for autoscaling"
  type        = number
  default     = 3
}

variable "cluster_addons" {
  description = "Core addons expected in the AWS EKS baseline"
  type        = list(string)
  default     = ["vpc-cni", "coredns", "kube-proxy", "ebs-csi-driver"]
}
