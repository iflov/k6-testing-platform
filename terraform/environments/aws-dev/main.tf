# -----------------------------------------------------------------------------
# DOCUMENTATION ONLY
# This environment intentionally models the AWS dev topology without creating
# resources. It exists to document module interfaces, variable values, and
# AWS-vs-GCP tradeoffs before committing to a live implementation.
# -----------------------------------------------------------------------------

terraform {
  required_version = ">= 1.5.0"
}

module "vpc" {
  source = "../../modules/aws/vpc"

  project_name          = var.project_name
  environment           = var.environment
  region                = var.region
  availability_zones    = var.availability_zones
  vpc_cidr              = var.vpc_cidr
  private_subnet_cidrs  = var.private_subnet_cidrs
  public_subnet_cidrs   = var.public_subnet_cidrs
  nat_gateway_mode      = var.nat_gateway_mode
  vpc_endpoint_strategy = var.vpc_endpoint_strategy
}

module "eks" {
  source = "../../modules/aws/eks"

  project_name        = var.project_name
  environment         = var.environment
  region              = var.region
  vpc_id              = module.vpc.vpc_id
  subnet_ids          = module.vpc.eks_subnet_ids
  kubernetes_version  = var.eks_kubernetes_version
  endpoint_access     = var.eks_endpoint_access
  node_instance_types = var.eks_node_instance_types
  desired_node_count  = var.eks_desired_nodes
  min_node_count      = var.eks_min_nodes
  max_node_count      = var.eks_max_nodes
  cluster_addons      = var.eks_cluster_addons
}

module "rds" {
  source = "../../modules/aws/rds"

  project_name          = var.project_name
  environment           = var.environment
  region                = var.region
  vpc_id                = module.vpc.vpc_id
  subnet_ids            = module.vpc.private_subnet_ids
  engine                = var.rds_engine
  engine_version        = var.rds_engine_version
  instance_class        = var.rds_instance_class
  allocated_storage_gb  = var.rds_allocated_storage_gb
  storage_type          = var.rds_storage_type
  multi_az              = var.rds_multi_az
  backup_retention_days = var.rds_backup_retention_days
  database_name         = var.rds_database_name
  db_username           = var.rds_db_username
}

module "ec2_influxdb" {
  source = "../../modules/aws/ec2-influxdb"

  project_name   = var.project_name
  environment    = var.environment
  region         = var.region
  vpc_id         = module.vpc.vpc_id
  subnet_id      = module.vpc.private_subnet_ids[0]
  instance_type  = var.influxdb_instance_type
  ami_family     = var.influxdb_ami_family
  root_volume_gb = var.influxdb_root_volume_gb
  data_volume_gb = var.influxdb_data_volume_gb
  service_port   = var.influxdb_service_port
  private_only   = var.influxdb_private_only
}
