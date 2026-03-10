output "vpc_id" {
  description = "The self-link of the VPC network"
  value       = google_compute_network.vpc.self_link
}

output "vpc_name" {
  description = "The name of the VPC network"
  value       = google_compute_network.vpc.name
}

output "gke_subnet_id" {
  description = "The self-link of the GKE subnet"
  value       = google_compute_subnetwork.gke.self_link
}

output "gke_subnet_name" {
  description = "The name of the GKE subnet"
  value       = google_compute_subnetwork.gke.name
}

output "pods_range_name" {
  description = "The secondary range name for GKE pods"
  value       = "${var.environment}-${var.project_name}-pods"
}

output "services_range_name" {
  description = "The secondary range name for GKE services"
  value       = "${var.environment}-${var.project_name}-services"
}
