variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "project_name" {
  description = "Short name used for resource naming"
  type        = string
  default     = "k6platform"
}

variable "region" {
  description = "GCP region for the Cloud SQL instance"
  type        = string
  default     = "asia-northeast3"
}

variable "environment" {
  description = "Deployment environment (e.g. dev, staging, prod)"
  type        = string
}

variable "vpc_id" {
  description = "Self-link of the VPC network for private IP"
  type        = string
}

variable "tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-f1-micro"
}

variable "availability_type" {
  description = "Availability type: ZONAL or REGIONAL (HA)"
  type        = string
  default     = "ZONAL"
}

variable "disk_size" {
  description = "Initial disk size in GB"
  type        = number
  default     = 10
}

variable "disk_autoresize_limit" {
  description = "Maximum disk size in GB for autoresize (0 = unlimited)"
  type        = number
  default     = 100
}

variable "database_name" {
  description = "Name of the application database"
  type        = string
  default     = "k6_test_history"
}

variable "db_user" {
  description = "Database user name for the application"
  type        = string
  default     = "k6app"
}

variable "db_password" {
  description = "Database user password (use Secret Manager in prod)"
  type        = string
  sensitive   = true
}

variable "deletion_protection" {
  description = "Enable deletion protection on the Cloud SQL instance"
  type        = bool
  default     = false
}
