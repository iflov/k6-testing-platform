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
  description = "GCP region for the GKE cluster"
  type        = string
  default     = "asia-northeast3"
}

variable "zone" {
  description = "GCP zone for the zonal GKE cluster"
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

variable "subnet_id" {
  description = "Self-link of the GKE subnet"
  type        = string
}

variable "pods_range_name" {
  description = "Name of the secondary IP range used for pods"
  type        = string
}

variable "services_range_name" {
  description = "Name of the secondary IP range used for services"
  type        = string
}

variable "master_ipv4_cidr_block" {
  description = "CIDR block for the GKE master network (must be /28)"
  type        = string
  default     = "172.16.0.0/28"
}

variable "master_authorized_networks" {
  description = "List of CIDR blocks authorized to reach the GKE master"
  type = list(object({
    cidr_block   = string
    display_name = string
  }))
  default = [
    {
      cidr_block   = "0.0.0.0/0"
      display_name = "all (restrict in prod)"
    }
  ]
}

variable "machine_type" {
  description = "Machine type for GKE nodes"
  type        = string
  default     = "e2-medium"
}

variable "disk_size_gb" {
  description = "Boot disk size in GB for each GKE node"
  type        = number
  default     = 50
}

variable "min_node_count" {
  description = "Minimum number of nodes in the node pool"
  type        = number
  default     = 1
}

variable "max_node_count" {
  description = "Maximum number of nodes in the node pool"
  type        = number
  default     = 3
}

variable "initial_node_count" {
  description = "Initial number of nodes when the pool is created"
  type        = number
  default     = 1
}
