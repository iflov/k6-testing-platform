# -----------------------------------------------------------------------------
# DOCUMENTATION ONLY
# Example values for the AWS dev documentation slice.
# Adjust these when converting the slice into a real implementation.
# -----------------------------------------------------------------------------

project_name          = "k6platform"
environment           = "dev"
region                = "ap-northeast-2"
availability_zones    = ["ap-northeast-2a", "ap-northeast-2c"]
vpc_cidr              = "10.20.0.0/16"
private_subnet_cidrs  = ["10.20.0.0/20", "10.20.16.0/20"]
public_subnet_cidrs   = ["10.20.128.0/24", "10.20.129.0/24"]
nat_gateway_mode      = "single"
vpc_endpoint_strategy = "core-services-only"

eks_kubernetes_version  = "1.31"
eks_endpoint_access     = "private"
eks_node_instance_types = ["t3.large"]
eks_desired_nodes       = 2
eks_min_nodes           = 1
eks_max_nodes           = 3
eks_cluster_addons      = ["vpc-cni", "coredns", "kube-proxy", "ebs-csi-driver"]

rds_engine                = "postgres"
rds_engine_version        = "16.4"
rds_instance_class        = "db.t4g.micro"
rds_allocated_storage_gb  = 20
rds_storage_type          = "gp3"
rds_multi_az              = false
rds_backup_retention_days = 7
rds_database_name         = "k6_test_history"
rds_db_username           = "k6app"

influxdb_instance_type  = "t3.small"
influxdb_ami_family     = "al2023"
influxdb_root_volume_gb = 20
influxdb_data_volume_gb = 50
influxdb_service_port   = 8181
influxdb_private_only   = true
