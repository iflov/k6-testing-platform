output "instance_name" {
  description = "The name of the Cloud SQL instance"
  value       = google_sql_database_instance.postgres.name
}

output "instance_connection_name" {
  description = "Connection name used with Cloud SQL Auth Proxy (project:region:instance)"
  value       = google_sql_database_instance.postgres.connection_name
}

output "private_ip_address" {
  description = "Private IP address of the Cloud SQL instance"
  value       = google_sql_database_instance.postgres.private_ip_address
}

output "database_name" {
  description = "The name of the application database"
  value       = google_sql_database.k6_test_history.name
}

output "db_user" {
  description = "The application database user"
  value       = google_sql_user.app_user.name
}
