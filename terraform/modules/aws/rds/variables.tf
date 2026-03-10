# -----------------------------------------------------------------------------
# DOCUMENTATION ONLY
# Variables define the intended AWS RDS interface for later implementation.
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
  description = "AWS region for the RDS design"
  type        = string
  default     = "ap-northeast-2"
}

variable "vpc_id" {
  description = "Planned VPC identifier passed from the VPC module"
  type        = string
}

variable "subnet_ids" {
  description = "Private subnet IDs intended for the DB subnet group"
  type        = list(string)
}

variable "engine" {
  description = "Target RDS engine"
  type        = string
  default     = "postgres"
}

variable "engine_version" {
  description = "Target PostgreSQL engine version"
  type        = string
  default     = "16.4"
}

variable "instance_class" {
  description = "Planned RDS instance class"
  type        = string
  default     = "db.t4g.micro"
}

variable "allocated_storage_gb" {
  description = "Initial storage allocation in GB"
  type        = number
  default     = 20
}

variable "storage_type" {
  description = "Planned AWS storage class"
  type        = string
  default     = "gp3"
}

variable "multi_az" {
  description = "Whether the eventual implementation should use Multi-AZ"
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Backup retention target in days"
  type        = number
  default     = 7
}

variable "database_name" {
  description = "Application database name"
  type        = string
  default     = "k6_test_history"
}

variable "db_username" {
  description = "Application database username"
  type        = string
  default     = "k6app"
}
