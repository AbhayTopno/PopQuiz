# PopQuiz GKE Terraform Deployment

Terraform configuration to deploy PopQuiz on Google Kubernetes Engine (GKE).

---

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **Terraform** installed ([Download](https://www.terraform.io/downloads))
3. **gcloud CLI** installed and authenticated ([Install Guide](https://cloud.google.com/sdk/docs/install))
4. **kubectl** installed

---

## Quick Start Guide

### Step 1: Install Terraform

**Windows (using Chocolatey):**

```powershell
choco install terraform
```

**Windows (using Scoop):**

```powershell
scoop install terraform
```

**macOS:**

```bash
brew install terraform
```

**Linux:**

```bash
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
```

**Verify installation:**

```bash
terraform version
```

---

### Step 2: Authenticate with Google Cloud

```bash
# Login to Google Cloud
gcloud auth login

# Set application default credentials for Terraform
gcloud auth application-default login

# Set your project (replace with your actual project ID)
gcloud config set project YOUR_PROJECT_ID

# Verify configuration
gcloud config list
```

---

### Step 3: Enable Required GCP APIs

```bash
# Enable necessary APIs
gcloud services enable container.googleapis.com
gcloud services enable compute.googleapis.com
gcloud services enable servicenetworking.googleapis.com
```

---

### Step 4: Configure Terraform Variables

```bash
# Navigate to terraform directory
cd terraform

# Copy example variables file
cp terraform.tfvars.example terraform.tfvars

# Edit terraform.tfvars with your values
# On Windows:
notepad terraform.tfvars

# On Linux/Mac:
nano terraform.tfvars
# or
vim terraform.tfvars
```

**Edit `terraform.tfvars`:**

```hcl
project_id   = "your-gcp-project-id"
region       = "asia-south1"
zone         = "asia-south1-a"
cluster_name = "popquiz-cluster"
environment  = "production"

node_count   = 2
machine_type = "e2-medium"
disk_size    = 20
disk_type    = "pd-standard"
```

---

### Step 5: Initialize Terraform

```bash
# Initialize Terraform (downloads required providers)
terraform init
```

Expected output:

```
Initializing the backend...
Initializing provider plugins...
- Installing hashicorp/google v5.x.x...
Terraform has been successfully initialized!
```

---

### Step 6: Plan the Deployment

```bash
# Preview what Terraform will create
terraform plan
```

This shows you all resources that will be created without actually creating them.

---

### Step 7: Apply the Configuration

```bash
# Create the GKE cluster
terraform apply
```

- Type `yes` when prompted to confirm
- Wait 5-10 minutes for cluster creation

Expected output:

```
Apply complete! Resources: 2 added, 0 changed, 0 destroyed.

Outputs:

cluster_name = "popquiz-cluster"
get_credentials_command = "gcloud container clusters get-credentials popquiz-cluster --zone asia-south1-a --project your-project-id"
```

---

### Step 8: Configure kubectl

```bash
# Use the command from terraform output
gcloud container clusters get-credentials popquiz-cluster --zone asia-south1-a --project YOUR_PROJECT_ID

# Or use terraform output directly
$(terraform output -raw get_credentials_command)

# Verify connection
kubectl cluster-info
kubectl get nodes
```

---

### Step 9: Deploy PopQuiz Application

```bash
# Navigate back to project root
cd ..

# Create namespace
kubectl create namespace popquiz

# Install ingress controller (if not already installed)
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

# Create secrets for the backend (e.g., database credentials)
kubectl create secret generic backend-secrets --namespace popquiz --from-env-file=.env.backend
# Create a configmap for the frontend (e.g., API URLs)
kubectl create configmap frontend-secrets --namespace popquiz --from-env-file=.env.frontend

# Deploy application
kubectl apply -f k8s/base/

# Check deployment status
kubectl get pods -n popquiz -w
```

---

### Step 10: Get External IP

```bash
# Wait for ingress to get external IP
kubectl get ingress -n popquiz -w

# Or check service
kubectl get svc -n popquiz
```

---

## Terraform Commands Reference

### View Current State

```bash
terraform show
```

### View Outputs

```bash
terraform output
terraform output cluster_name
terraform output -raw get_credentials_command
```

### Format Code

```bash
terraform fmt
```

### Validate Configuration

```bash
terraform validate
```

### Update Infrastructure

```bash
# Make changes to .tf files, then:
terraform plan
terraform apply
```

### Destroy Infrastructure

```bash
# WARNING: This deletes the entire cluster
terraform destroy
```

---

## Configuration Options

### Minimal Setup (Free Tier Compatible)

Edit `terraform.tfvars`:

```hcl
node_count   = 1
machine_type = "e2-small"
disk_size    = 10
disk_type    = "pd-standard"
```

### Production Setup

Edit `terraform.tfvars`:

```hcl
node_count   = 2
machine_type = "e2-standard-2"
disk_size    = 20
disk_type    = "pd-ssd"
```

---

## Scaling the Cluster

### Scale Node Pool

```bash
# Increase nodes
gcloud container clusters resize popquiz-cluster \
  --node-pool popquiz-cluster-node-pool \
  --num-nodes 3 \
  --zone asia-south1-a
```

Or update `terraform.tfvars` and run:

```bash
terraform apply
```

---

## Cost Estimation

### Check Estimated Costs

```bash
# Install cost estimation tool
terraform plan -out=tfplan
terraform show -json tfplan > plan.json

# Use GCP Pricing Calculator
# https://cloud.google.com/products/calculator
```

### Approximate Monthly Costs (asia-south1)

- **e2-small (1 vCPU, 2GB):** ~$12/month per node
- **e2-medium (2 vCPU, 4GB):** ~$24/month per node
- **pd-standard (10GB):** ~$0.40/month
- **pd-ssd (10GB):** ~$1.70/month

**2-node e2-medium cluster:** ~$50/month

---

## Troubleshooting

### Authentication Issues

```bash
# Re-authenticate
gcloud auth application-default login
```

### Quota Issues

```bash
# Check quotas
gcloud compute project-info describe --project YOUR_PROJECT_ID

# Request quota increase through GCP Console
```

### State Lock Issues

```bash
# If state is locked, force unlock (use with caution)
terraform force-unlock LOCK_ID
```

### Reset Everything

```bash
# Remove local state
rm -rf .terraform
rm terraform.tfstate*

# Re-initialize
terraform init
```

---

## Advanced Features

### Enable Auto-scaling

Add to `main.tf`:

```hcl
resource "google_container_node_pool" "primary_nodes" {
  # ... existing config ...

  autoscaling {
    min_node_count = 1
    max_node_count = 5
  }
}
```

### Add Preemptible Nodes

Add to `main.tf`:

```hcl
resource "google_container_node_pool" "primary_nodes" {
  node_config {
    # ... existing config ...
    preemptible = true
  }
}
```

---

## Cleanup

### Destroy Everything

```bash
# Navigate to terraform directory
cd terraform

# Destroy all resources
terraform destroy

# Type 'yes' to confirm
```

**Note:** This will delete the entire cluster and all resources managed by Terraform.

---

## Best Practices

1. **Never commit `terraform.tfvars`** - Contains sensitive data
2. **Use remote state** for production (GCS bucket)
3. **Enable state locking** to prevent concurrent modifications
4. **Use workspaces** for multiple environments
5. **Tag all resources** for cost tracking
6. **Regular backups** of terraform state

---

## Next Steps

After cluster is created:

1. Configure kubectl
2. Deploy application using k8s manifests
3. Set up monitoring (Stackdriver)
4. Configure CI/CD pipeline
5. Set up HTTPS with cert-manager

---

## Useful Links

- [Terraform Google Provider Docs](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- [GKE Terraform Examples](https://github.com/terraform-google-modules/terraform-google-kubernetes-engine)
- [Terraform Best Practices](https://www.terraform.io/docs/cloud/guides/recommended-practices/index.html)

---

## Complete Command Flow

```bash
# 1. Setup
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable container.googleapis.com compute.googleapis.com

# 2. Terraform
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values
terraform init
terraform plan
terraform apply

# 3. Configure kubectl
gcloud container clusters get-credentials popquiz-cluster --zone asia-south1-a

# 4. Deploy app
cd ..
kubectl create namespace popquiz
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
kubectl create secret generic backend-secrets --from-env-file=k8s/.env.backend -n popquiz
kubectl apply -f k8s/base/

# 5. Verify
kubectl get pods -n popquiz
kubectl get svc -n popquiz
kubectl get ingress -n popquiz

# 6. Access app
# Use the external IP from ingress
```
