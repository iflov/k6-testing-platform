variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "project_name" {
  description = "Short name used for resource naming"
  type        = string
  default     = "k6platform"
}

variable "zone" {
  description = "GCP zone for the GCE instance"
  type        = string
  default     = "asia-northeast3-a"
}

variable "environment" {
  description = "Deployment environment (e.g. dev, staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "Self-link of the VPC network"
  type        = string
}

variable "vpc_name" {
  description = "Name of the VPC network (used in firewall rules)"
  type        = string
}

variable "subnet_id" {
  description = "Self-link of the subnet to attach the instance to"
  type        = string
}

variable "machine_type" {
  description = "Machine type for the InfluxDB GCE instance"
  type        = string
  default     = "e2-small"
}

variable "data_disk_size_gb" {
  description = "Size of the persistent SSD data disk in GB"
  type        = number
  default     = 20
}
