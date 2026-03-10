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
  description = "GCP region for the Artifact Registry repository"
  type        = string
  default     = "asia-northeast3"
}

variable "environment" {
  description = "Deployment environment (e.g. dev, staging, prod)"
  type        = string
}

variable "gke_node_service_account" {
  description = "Service account email of GKE nodes (granted reader access)"
  type        = string
}
