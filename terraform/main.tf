# Terraform configuration for PopQuiz GKE deployment
terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# Configure the Google Cloud Provider
provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# Create GKE Cluster
resource "google_container_cluster" "popquiz_cluster" {
  name     = var.cluster_name
  location = var.zone

  # Minimal node pool configuration
  initial_node_count       = 1
  remove_default_node_pool = true
  deletion_protection      = false

  # Network configuration
  network    = "default"
  subnetwork = "default"

  # Workload identity configuration (recommended)
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Release channel for automatic updates
  release_channel {
    channel = "REGULAR"
  }
}

# Create separately managed node pool
resource "google_container_node_pool" "primary_nodes" {
  name       = "${var.cluster_name}-node-pool"
  location   = var.zone
  cluster    = google_container_cluster.popquiz_cluster.name
  node_count = var.node_count

  # Node configuration
  node_config {
    machine_type = var.machine_type
    disk_size_gb = var.disk_size
    disk_type    = var.disk_type

    # OAuth scopes
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    # Metadata
    metadata = {
      disable-legacy-endpoints = "true"
    }

    # Labels
    labels = {
      environment = var.environment
      app         = "popquiz"
    }

    # Tags
    tags = ["popquiz", var.environment]
  }

  # Auto-repair and auto-upgrade
  management {
    auto_repair  = true
    auto_upgrade = true
  }
}

# Output cluster information
output "cluster_name" {
  description = "GKE cluster name"
  value       = google_container_cluster.popquiz_cluster.name
}

output "cluster_endpoint" {
  description = "GKE cluster endpoint"
  value       = google_container_cluster.popquiz_cluster.endpoint
  sensitive   = true
}

output "cluster_ca_certificate" {
  description = "GKE cluster CA certificate"
  value       = google_container_cluster.popquiz_cluster.master_auth[0].cluster_ca_certificate
  sensitive   = true
}

output "get_credentials_command" {
  description = "Command to configure kubectl"
  value       = "gcloud container clusters get-credentials ${google_container_cluster.popquiz_cluster.name} --zone ${var.zone} --project ${var.project_id}"
}
