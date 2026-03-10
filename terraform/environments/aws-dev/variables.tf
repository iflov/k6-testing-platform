# -----------------------------------------------------------------------------
# DOCUMENTATION ONLY
# Variables capture the planned AWS dev footprint without provisioning.
# -----------------------------------------------------------------------------

variable "project_name" {
  description = "Short name used for resource naming"
  type        = string
  default     = "k6platform"
}

variable "environment" {
  description = "Deployment environment label"
  type        = string
  default     = "dev"
}

variable "region" {
  description = "AWS region for the dev environment"
  type        = string
  default     = "ap-northeast-2"
}

variable "availability_zones" {
  description = "AZs intended for the dev VPC footprint"
  type        = list(string)
  default     = ["ap-northeast-2a", "ap-northeast-2c"]
}

variable "vpc_cidr" {
  description = "Primary CIDR block for the AWS dev VPC"
  type        = string
  default     = "10.20.0.0/16"
}

variable "private_subnet_cidrs" {
  description = "Private subnet CIDRs for EKS, RDS, and internal services"
  type        = list(string)
  default     = ["10.20.0.0/20", "10.20.16.0/20"]
}

variable "public_subnet_cidrs" {
  description = "Public subnet CIDRs for future ingress resources"
  type        = list(string)
  default     = ["10.20.128.0/24", "10.20.129.0/24"]
}

variable "nat_gateway_mode" {
  description = "Planned NAT gateway strategy for dev"
  type        = string
  default     = "single"
}

variable "vpc_endpoint_strategy" {
  description = "Planned VPC endpoint footprint for dev"
  type        = string
  default     = "core-services-only"
}

variable "eks_kubernetes_version" {
  description = "Target Kubernetes version for the EKS cluster"
  type        = string
  default     = "1.31"
}

variable "eks_endpoint_access" {
  description = "Control plane endpoint posture"
  type        = string
  default     = "private"
}

variable "eks_node_instance_types" {
  description = "Planned node instance types for the default managed node group"
  type        = list(string)
  default     = ["t3.large"]
}

variable "eks_desired_nodes" {
  description = "Desired node count for the default managed node group"
  type        = number
  default     = 2
}

variable "eks_min_nodes" {
  description = "Minimum node count for the default managed node group"
  type        = number
  default     = 1
}

variable "eks_max_nodes" {
  description = "Maximum node count for the default managed node group"
  type        = number
  default     = 3
}

variable "eks_cluster_addons" {
  description = "Core addons expected in the AWS EKS baseline"
  type        = list(string)
  default     = ["vpc-cni", "coredns", "kube-proxy", "ebs-csi-driver"]
}

variable "rds_engine" {
  description = "Target RDS engine"
  type        = string
  default     = "postgres"
}

variable "rds_engine_version" {
  description = "Target PostgreSQL engine version"
  type        = string
  default     = "16.4"
}

variable "rds_instance_class" {
  description = "Planned instance class for the dev database"
  type        = string
  default     = "db.t4g.micro"
}

variable "rds_allocated_storage_gb" {
  description = "Initial DB storage size in GB"
  type        = number
  default     = 20
}

variable "rds_storage_type" {
  description = "Planned DB storage type"
  type        = string
  default     = "gp3"
}

variable "rds_multi_az" {
  description = "Whether the eventual DB should be Multi-AZ"
  type        = bool
  default     = false
}

variable "rds_backup_retention_days" {
  description = "Backup retention target in days"
  type        = number
  default     = 7
}

variable "rds_database_name" {
  description = "Application database name"
  type        = string
  default     = "k6_test_history"
}

variable "rds_db_username" {
  description = "Application database username"
  type        = string
  default     = "k6app"
}

variable "influxdb_instance_type" {
  description = "Planned EC2 instance type for InfluxDB"
  type        = string
  default     = "t3.small"
}

variable "influxdb_ami_family" {
  description = "Base AMI family for the InfluxDB host"
  type        = string
  default     = "al2023"
}

variable "influxdb_root_volume_gb" {
  description = "Root volume size in GB"
  type        = number
  default     = 20
}

variable "influxdb_data_volume_gb" {
  description = "Dedicated data volume size in GB"
  type        = number
  default     = 50
}

variable "influxdb_service_port" {
  description = "InfluxDB HTTP port exposed inside the VPC"
  type        = number
  default     = 8181
}

variable "influxdb_private_only" {
  description = "Whether the host should remain private-only"
  type        = bool
  default     = true
}
