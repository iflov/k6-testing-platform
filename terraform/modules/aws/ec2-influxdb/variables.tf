# -----------------------------------------------------------------------------
# DOCUMENTATION ONLY
# Variables define the intended EC2-hosted InfluxDB interface for later implementation.
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
  description = "AWS region for the EC2 design"
  type        = string
  default     = "ap-northeast-2"
}

variable "vpc_id" {
  description = "Planned VPC identifier passed from the VPC module"
  type        = string
}

variable "subnet_id" {
  description = "Private subnet ID intended for the EC2 instance"
  type        = string
}

variable "instance_type" {
  description = "Planned EC2 instance type for the InfluxDB host"
  type        = string
  default     = "t3.small"
}

variable "ami_family" {
  description = "Intended base AMI family for the host"
  type        = string
  default     = "al2023"
}

variable "root_volume_gb" {
  description = "Root volume size in GB"
  type        = number
  default     = 20
}

variable "data_volume_gb" {
  description = "Dedicated data volume size in GB"
  type        = number
  default     = 50
}

variable "service_port" {
  description = "InfluxDB HTTP port exposed inside the VPC"
  type        = number
  default     = 8181
}

variable "private_only" {
  description = "Whether the host should remain private-only without a public IP"
  type        = bool
  default     = true
}
