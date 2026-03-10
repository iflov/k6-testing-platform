resource "google_artifact_registry_repository" "docker" {
  provider = google-beta

  repository_id = "${var.environment}-${var.project_name}"
  format        = "DOCKER"
  location      = var.region
  project       = var.project_id
  description   = "Docker image registry for ${var.project_name} (${var.environment})"

  labels = {
    environment = var.environment
    project     = var.project_name
    managed-by  = "terraform"
  }
}

# Grant GKE node service account read access to pull images
resource "google_artifact_registry_repository_iam_member" "gke_reader" {
  provider = google-beta

  project    = var.project_id
  location   = var.region
  repository = google_artifact_registry_repository.docker.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${var.gke_node_service_account}"
}
