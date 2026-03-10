# -----------------------------------------------------------------------------
# DOCUMENTATION ONLY
# Variables define the intended AWS VPC interface for later implementation.
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
  description = "AWS region for the VPC design"
  type        = string
  default     = "ap-northeast-2"
}

variable "availability_zones" {
  description = "AZs intended for multi-AZ private/public subnet placement"
  type        = list(string)
  default     = ["ap-northeast-2a", "ap-northeast-2c"]
}

variable "vpc_cidr" {
  description = "Primary CIDR block for the AWS VPC"
  type        = string
  default     = "10.20.0.0/16"
}

variable "private_subnet_cidrs" {
  description = "Private subnet CIDRs reserved for EKS nodes, RDS, and internal services"
  type        = list(string)
  default     = ["10.20.0.0/20", "10.20.16.0/20"]
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDRs reserved for load balancers or bastion-style ingress"
  type        = list(string)
  default     = ["10.20.128.0/24", "10.20.129.0/24"]
}

variable "nat_gateway_mode" {
  description = "Planned NAT gateway strategy: single for cost, per-az for resilience"
  type        = string
  default     = "single"
}

variable "vpc_endpoint_strategy" {
  description = "Planned endpoint posture for ECR, S3, CloudWatch, and STS access"
  type        = string
  default     = "core-services-only"
}
