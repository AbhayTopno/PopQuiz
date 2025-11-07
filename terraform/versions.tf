# Terraform version and provider configuration
terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

# Terraform backend configuration (optional)
# Uncomment and configure after creating GCS bucket for remote state storage

# terraform {
#   backend "gcs" {
#     bucket  = "your-terraform-state-bucket"
#     prefix  = "terraform/state"
#   }
# }
