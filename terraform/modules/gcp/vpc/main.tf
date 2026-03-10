resource "google_compute_network" "vpc" {
  name                    = "${var.environment}-${var.project_name}-vpc"
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"

  project = var.project_id
}

resource "google_compute_subnetwork" "gke" {
  name          = "${var.environment}-${var.project_name}-gke-subnet"
  ip_cidr_range = var.gke_subnet_cidr
  region        = var.region
  network       = google_compute_network.vpc.id
  project       = var.project_id

  private_ip_google_access = true

  secondary_ip_range {
    range_name    = "${var.environment}-${var.project_name}-pods"
    ip_cidr_range = var.pods_cidr
  }

  secondary_ip_range {
    range_name    = "${var.environment}-${var.project_name}-services"
    ip_cidr_range = var.services_cidr
  }
}

resource "google_compute_router" "router" {
  name    = "${var.environment}-${var.project_name}-router"
  region  = var.region
  network = google_compute_network.vpc.id
  project = var.project_id
}

resource "google_compute_router_nat" "nat" {
  name                               = "${var.environment}-${var.project_name}-nat"
  router                             = google_compute_router.router.name
  region                             = var.region
  project                            = var.project_id
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# Firewall: allow internal traffic
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.environment}-${var.project_name}-allow-internal"
  network = google_compute_network.vpc.name
  project = var.project_id

  allow {
    protocol = "tcp"
  }

  allow {
    protocol = "udp"
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = [
    var.gke_subnet_cidr,
    var.pods_cidr,
    var.services_cidr,
  ]

  priority = 1000
}

# Firewall: allow GCP health checks
resource "google_compute_firewall" "allow_health_checks" {
  name    = "${var.environment}-${var.project_name}-allow-health-checks"
  network = google_compute_network.vpc.name
  project = var.project_id

  allow {
    protocol = "tcp"
  }

  # GCP health check source ranges
  source_ranges = [
    "35.191.0.0/16",
    "130.211.0.0/22",
  ]

  priority = 1000
}

# Firewall: allow SSH via Identity-Aware Proxy
resource "google_compute_firewall" "allow_iap_ssh" {
  name    = "${var.environment}-${var.project_name}-allow-iap-ssh"
  network = google_compute_network.vpc.name
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  # IAP source range
  source_ranges = ["35.235.240.0/20"]

  priority = 1000
}
