variable "project_id" {
  description = "The GCP project ID to deploy resources into"
  type        = string
}

variable "project_name" {
  description = "Short name used as a prefix in resource names"
  type        = string
  default     = "k6platform"
}

variable "region" {
  description = "GCP region for all regional resources"
  type        = string
  default     = "asia-northeast3"
}

variable "zone" {
  description = "GCP zone for zonal resources (GKE cluster, GCE instance)"
  type        = string
  default     = "asia-northeast3-a"
}

variable "environment" {
  description = "Deployment environment label applied to all resources"
  type        = string
  default     = "dev"
}

# GKE
variable "gke_machine_type" {
  description = "Machine type for GKE worker nodes"
  type        = string
  default     = "e2-medium"
}

variable "gke_min_nodes" {
  description = "Minimum node count for autoscaling"
  type        = number
  default     = 1
}

variable "gke_max_nodes" {
  description = "Maximum node count for autoscaling"
  type        = number
  default     = 3
}

variable "gke_initial_nodes" {
  description = "Initial node count when the pool is created"
  type        = number
  default     = 1
}

# Cloud SQL
variable "cloudsql_tier" {
  description = "Cloud SQL machine tier (db-f1-micro for dev/staging)"
  type        = string
  default     = "db-f1-micro"
}

variable "db_password" {
  description = "Password for the Cloud SQL application user (use Secret Manager in prod)"
  type        = string
  sensitive   = true
}
