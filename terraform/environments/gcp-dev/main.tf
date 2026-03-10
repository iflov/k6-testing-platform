terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# ---------------------------------------------------------------------------
# VPC
# ---------------------------------------------------------------------------
module "vpc" {
  source = "../../modules/gcp/vpc"

  project_id   = var.project_id
  project_name = var.project_name
  region       = var.region
  environment  = var.environment
}

# ---------------------------------------------------------------------------
# GKE
# ---------------------------------------------------------------------------
module "gke" {
  source = "../../modules/gcp/gke"

  project_id   = var.project_id
  project_name = var.project_name
  region       = var.region
  zone         = var.zone
  environment  = var.environment

  vpc_id              = module.vpc.vpc_id
  subnet_id           = module.vpc.gke_subnet_id
  pods_range_name     = module.vpc.pods_range_name
  services_range_name = module.vpc.services_range_name

  machine_type       = var.gke_machine_type
  min_node_count     = var.gke_min_nodes
  max_node_count     = var.gke_max_nodes
  initial_node_count = var.gke_initial_nodes
}

# ---------------------------------------------------------------------------
# Cloud SQL (PostgreSQL)
# ---------------------------------------------------------------------------
module "cloud_sql" {
  source = "../../modules/gcp/cloud-sql"

  project_id   = var.project_id
  project_name = var.project_name
  region       = var.region
  environment  = var.environment

  vpc_id      = module.vpc.vpc_id
  tier        = var.cloudsql_tier
  db_password = var.db_password
}

# ---------------------------------------------------------------------------
# GCE InfluxDB
# ---------------------------------------------------------------------------
module "gce_influxdb" {
  source = "../../modules/gcp/gce-influxdb"

  project_id   = var.project_id
  project_name = var.project_name
  zone         = var.zone
  environment  = var.environment

  vpc_id    = module.vpc.vpc_id
  vpc_name  = module.vpc.vpc_name
  subnet_id = module.vpc.gke_subnet_id
}

# ---------------------------------------------------------------------------
# Artifact Registry
# ---------------------------------------------------------------------------
module "artifact_registry" {
  source = "../../modules/gcp/artifact-registry"

  project_id   = var.project_id
  project_name = var.project_name
  region       = var.region
  environment  = var.environment

  gke_node_service_account = module.gke.node_service_account
}
