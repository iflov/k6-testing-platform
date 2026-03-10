# -----------------------------------------------------------------------------
# DOCUMENTATION ONLY
# This module documents the intended EC2-hosted InfluxDB topology.
# It preserves Terraform wiring while intentionally creating no AWS resources.
# -----------------------------------------------------------------------------

locals {
  documentation_only = true

  instance_name        = "${var.environment}-${var.project_name}-influxdb"
  security_group_id    = "doc-${var.environment}-${var.project_name}-influxdb-sg"
  iam_role_name        = "${var.environment}-${var.project_name}-influxdb-role"
  target_volume_device = "/dev/xvdb"

  architecture_summary = {
    instance_type        = var.instance_type
    ami_family           = var.ami_family
    root_volume_gb       = var.root_volume_gb
    data_volume_gb       = var.data_volume_gb
    service_port         = var.service_port
    private_only         = var.private_only
    docker_runtime       = true
    persistent_data_path = "/data/influxdb"
  }
}
