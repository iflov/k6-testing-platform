locals {
  startup_script = <<-EOT
    #!/bin/bash
    set -euo pipefail

    # Install Docker
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg lsb-release

    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/debian/gpg \
      | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
      https://download.docker.com/linux/debian \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
      | tee /etc/apt/sources.list.d/docker.list > /dev/null

    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    systemctl enable docker
    systemctl start docker

    # Mount persistent disk
    DISK_DEVICE="/dev/disk/by-id/google-${var.environment}-${var.project_name}-influxdb-data"
    MOUNT_POINT="/data/influxdb"
    mkdir -p "$MOUNT_POINT"

    if ! blkid "$DISK_DEVICE"; then
      mkfs.ext4 -F "$DISK_DEVICE"
    fi

    echo "$DISK_DEVICE $MOUNT_POINT ext4 defaults,nofail 0 2" >> /etc/fstab
    mount -a

    chown -R 1000:1000 "$MOUNT_POINT"

    # Write docker-compose file
    mkdir -p /opt/influxdb
    cat > /opt/influxdb/docker-compose.yml <<'COMPOSE'
    version: "3.8"
    services:
      influxdb:
        image: influxdb:3-core
        container_name: influxdb
        restart: unless-stopped
        ports:
          - "8181:8181"
        volumes:
          - /data/influxdb:/var/lib/influxdb3
        command:
          - serve
          - --object-store
          - file
          - --data-dir
          - /var/lib/influxdb3
          - --ram-pool-data-bytes
          - "536870912"
        environment:
          - INFLUXDB_HTTP_BIND_ADDRESS=:8181
    COMPOSE

    # Start InfluxDB
    docker compose -f /opt/influxdb/docker-compose.yml up -d
  EOT
}

resource "google_compute_disk" "influxdb_data" {
  name    = "${var.environment}-${var.project_name}-influxdb-data"
  type    = "pd-ssd"
  zone    = var.zone
  size    = var.data_disk_size_gb
  project = var.project_id

  labels = {
    environment = var.environment
    project     = var.project_name
    managed-by  = "terraform"
  }
}

resource "google_compute_instance" "influxdb" {
  name         = "${var.environment}-${var.project_name}-influxdb"
  machine_type = var.machine_type
  zone         = var.zone
  project      = var.project_id

  tags = ["influxdb", var.environment]

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 20
      type  = "pd-standard"
    }
  }

  attached_disk {
    source      = google_compute_disk.influxdb_data.self_link
    device_name = "${var.environment}-${var.project_name}-influxdb-data"
    mode        = "READ_WRITE"
  }

  network_interface {
    network    = var.vpc_id
    subnetwork = var.subnet_id
    # No access_config = no public IP (private only)
  }

  metadata = {
    startup-script = local.startup_script
  }

  service_account {
    email  = google_service_account.influxdb.email
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }

  shielded_instance_config {
    enable_secure_boot          = true
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  allow_stopping_for_update = true

  labels = {
    environment = var.environment
    project     = var.project_name
    managed-by  = "terraform"
  }
}

resource "google_service_account" "influxdb" {
  account_id   = "${var.environment}-influxdb-sa"
  display_name = "InfluxDB GCE Service Account (${var.environment})"
  project      = var.project_id
}

# Firewall rule: allow GKE nodes to reach InfluxDB on port 8181
resource "google_compute_firewall" "allow_influxdb" {
  name    = "${var.environment}-${var.project_name}-allow-influxdb"
  network = var.vpc_name
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["8181"]
  }

  source_tags = ["gke-node"]
  target_tags = ["influxdb"]

  priority = 1000

  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}
