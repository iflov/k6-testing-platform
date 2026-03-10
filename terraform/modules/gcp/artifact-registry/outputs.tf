output "repository_id" {
  description = "The ID of the Artifact Registry repository"
  value       = google_artifact_registry_repository.docker.repository_id
}

output "repository_name" {
  description = "The full resource name of the Artifact Registry repository"
  value       = google_artifact_registry_repository.docker.name
}

output "registry_url" {
  description = "Docker registry URL (use with docker push/pull)"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.docker.repository_id}"
}
