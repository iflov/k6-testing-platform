output "instance_name" {
  description = "The name of the InfluxDB GCE instance"
  value       = google_compute_instance.influxdb.name
}

output "internal_ip" {
  description = "Internal IP address of the InfluxDB instance"
  value       = google_compute_instance.influxdb.network_interface[0].network_ip
}

output "service_account_email" {
  description = "Service account email attached to the InfluxDB instance"
  value       = google_service_account.influxdb.email
}

output "influxdb_url" {
  description = "Internal URL for the InfluxDB HTTP API"
  value       = "http://${google_compute_instance.influxdb.network_interface[0].network_ip}:8181"
}
