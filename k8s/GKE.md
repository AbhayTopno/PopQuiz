# Google Kubernetes Engine (GKE) Setup Guide

Complete guide to deploy PopQuiz on Google Kubernetes Engine.

---

## Prerequisites

- Google Cloud account with billing enabled
- `gcloud` CLI installed ([Install Guide](https://cloud.google.com/sdk/docs/install))
- `kubectl` installed
- Docker images pushed to Docker Hub

---

## 1. Initial GCP Setup

### Authenticate with Google Cloud

```bash
gcloud auth login
```

### Set Your Project

```bash
# Replace with your actual project ID
gcloud config set project YOUR_PROJECT_ID

# Verify configuration
gcloud config list
```

### Enable Required APIs

```bash
gcloud services enable container.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable compute.googleapis.com
```

---

## 2. Create GKE Cluster

### Option 1: Standard Disk (Recommended for Free Tier)

```bash
# Set your preferred zone
ZONE=asia-south1-a  # Mumbai, India

# Create cluster with standard disks
gcloud container clusters create popquiz-cluster \
  --zone $ZONE \
  --num-nodes=2 \
  --machine-type=e2-medium \
  --disk-type=pd-standard \
  --disk-size=10GB
```

**Notes:**

- `pd-standard` = HDD (cheaper, lower quota usage)
- `e2-medium` = 2 vCPUs, 4 GB RAM
- Zonal cluster (cheaper than regional)

### Option 2: SSD Disk (Better Performance)

```bash
ZONE=asia-south1-a

gcloud container clusters create popquiz-cluster \
  --zone $ZONE \
  --num-nodes=2 \
  --machine-type=e2-medium \
  --disk-type=pd-ssd \
  --disk-size=10GB
```

### Option 3: Minimal Cluster (Free Tier Compatible)

```bash
ZONE=asia-south1-a

gcloud container clusters create popquiz-cluster \
  --zone $ZONE \
  --num-nodes=1 \
  --machine-type=e2-small \
  --disk-type=pd-standard \
  --disk-size=10GB
```

---

## 3. Connect to Your Cluster

### Get Cluster Credentials

```bash
ZONE=asia-south1-a

gcloud container clusters get-credentials popquiz-cluster --zone $ZONE
```

### Install Auth Plugin (if needed)

```bash
gcloud components install gke-gcloud-auth-plugin
```

### Verify Connection

```bash
kubectl cluster-info
kubectl get nodes
```

---

## 4. Get External IP Address

After creating the cluster, you need to get the external IP for your ingress:

```bash
# Create a temporary LoadBalancer service to get external IP
kubectl create service loadbalancer temp-lb --tcp=80:80

# Wait a moment, then get the external IP
kubectl get service temp-lb

# Note the EXTERNAL-IP (e.g., 35.200.194.226)
# Delete the temporary service
kubectl delete service temp-lb
```

---

## 5. Update Configuration Files

Replace `YOUR_CLUSTER_IP` in all deployment files with your actual external IP:

### Files to Update:

- `k8s/base/deployment.yml`
- `k8s/base/ingress.yml`
- `k8s/blue-green/deployment-blue.yml`
- `k8s/blue-green/deployment-green.yml`
- `k8s/canary/deployment-stable.yml`
- `k8s/canary/deployment-canary.yml`
- `k8s/.env.backend`

**Example:**
Replace `YOUR_CLUSTER_IP.nip.io` with `35.200.194.226.nip.io`

**Using sed (Linux/Mac/WSL):**

```bash
# Replace in all files at once
find k8s -name "*.yml" -type f -exec sed -i 's/YOUR_CLUSTER_IP.nip.io/35.200.194.226.nip.io/g' {} +
```

**Using PowerShell (Windows):**

```powershell
$IP = "35.200.194.226"
Get-ChildItem k8s -Recurse -Include *.yml | ForEach-Object {
    (Get-Content $_) -replace 'YOUR_CLUSTER_IP', $IP | Set-Content $_
}
```

---

## 6. Setup Environment Variables

### Create Your Environment Files

Copy the example files and fill in your actual values:

```bash
# Copy example files
cp k8s/.env.example.backend k8s/.env.backend
cp k8s/.env.example.frontend k8s/.env.frontend

# Edit the files with your actual values
# Replace YOUR_CLUSTER_IP, YOUR_MONGODB_USER, YOUR_PASSWORD, etc.
```

### Backend Secrets

Create Kubernetes secrets from your `.env.backend` file:

```bash
kubectl create namespace popquiz

kubectl create secret generic backend-secrets \
  --from-env-file=k8s/.env.backend \
  --namespace=popquiz
```

Or create manually:

```bash
kubectl create secret generic backend-secrets \
  --from-literal=MONGO_URI='mongodb://url/popquiz' \
  --from-literal=JWT_SECRET='your-super-secret-jwt-key-min-32-chars' \
  --from-literal=GROQ_API_KEY='gsk_your_groq_api_key_here' \
  --namespace=popquiz
```

**Note:** Never commit your actual `.env.backend` or `.env.frontend` files to Git! They are already in `.gitignore`.

---

## 7. Deploy to GKE

### Deploy Base Configuration

```bash
kubectl apply -f k8s/base/
```

### Verify Deployment

```bash
# Check all resources
kubectl get all -n popquiz

# Check pods status
kubectl get pods -n popquiz

# Check services
kubectl get svc -n popquiz

# Check ingress
kubectl get ingress -n popquiz
```

### View Logs

```bash
# Backend logs
kubectl logs -f deployment/popquiz-backend-deployment -n popquiz

# Frontend logs
kubectl logs -f deployment/popquiz-frontend-deployment -n popquiz
```

---

## 8. Access Your Application

After deployment, access your app at:

```
http://YOUR_EXTERNAL_IP.nip.io
```

Example: `http://35.200.194.226.nip.io`

**Note:** `.nip.io` is a wildcard DNS service that automatically resolves to your IP.

---

## 9. Deployment Strategies

### Blue-Green Deployment

```bash
# Deploy blue version
kubectl apply -f k8s/blue-green/deployment-blue.yml
kubectl apply -f k8s/blue-green/service.yml
kubectl apply -f k8s/blue-green/ingress.yml

# Test, then switch to green
kubectl apply -f k8s/blue-green/deployment-green.yml
# Update service selector to point to green
```

### Canary Deployment

```bash
# Deploy stable version
kubectl apply -f k8s/canary/deployment-stable.yml

# Deploy canary with 10% traffic
kubectl apply -f k8s/canary/deployment-canary.yml
kubectl apply -f k8s/canary/service.yml
kubectl apply -f k8s/canary/ingress-stable.yml
kubectl apply -f k8s/canary/ingress-canary.yml
```

---

## 10. Monitoring & Troubleshooting

### Check Pod Status

```bash
kubectl get pods -n popquiz -w
```

### Describe Pod (for errors)

```bash
kubectl describe pod <pod-name> -n popquiz
```

### View Events

```bash
kubectl get events -n popquiz --sort-by='.lastTimestamp'
```

### Shell into Pod

```bash
kubectl exec -it <pod-name> -n popquiz -- /bin/sh
```

### Port Forward (for local testing)

```bash
# Backend
kubectl port-forward svc/popquiz-backend-service 5000:80 -n popquiz

# Frontend
kubectl port-forward svc/popquiz-frontend-service 3000:80 -n popquiz
```

---

## 11. Scaling

### Manual Scaling

```bash
# Scale backend
kubectl scale deployment popquiz-backend-deployment --replicas=3 -n popquiz

# Scale frontend
kubectl scale deployment popquiz-frontend-deployment --replicas=3 -n popquiz
```

### Auto-scaling

```bash
# Horizontal Pod Autoscaler
kubectl apply -f k8s/autoscaling/hpa.yml

# Vertical Pod Autoscaler
kubectl apply -f k8s/autoscaling/vpa.yml
```

---

## 12. Updates & Rollbacks

### Update Image Version

```bash
kubectl set image deployment/popquiz-backend-deployment \
  popquiz-backend=abhaytopno/popquiz-backend:v5 \
  -n popquiz
```

### Check Rollout Status

```bash
kubectl rollout status deployment/popquiz-backend-deployment -n popquiz
```

### Rollback

```bash
kubectl rollout undo deployment/popquiz-backend-deployment -n popquiz
```

### View Rollout History

```bash
kubectl rollout history deployment/popquiz-backend-deployment -n popquiz
```

---

## 13. Cleanup

### Delete Specific Resources

```bash
kubectl delete -f k8s/base/ -n popquiz
```

### Delete Namespace (deletes everything)

```bash
kubectl delete namespace popquiz
```

### Delete GKE Cluster

```bash
ZONE=asia-south1-a

gcloud container clusters delete popquiz-cluster \
  --zone $ZONE \
  --quiet
```

---

## 14. Cost Optimization

### Check Cluster Cost

```bash
gcloud container clusters describe popquiz-cluster --zone $ZONE --format="value(currentMasterVersion,currentNodeCount,currentNodeVersion)"
```

### Use Preemptible Nodes (70% cheaper)

```bash
gcloud container node-pools create preemptible-pool \
  --cluster=popquiz-cluster \
  --zone=$ZONE \
  --preemptible \
  --machine-type=e2-medium \
  --num-nodes=2
```

### Enable Cluster Autoscaler

```bash
gcloud container clusters update popquiz-cluster \
  --enable-autoscaling \
  --min-nodes=1 \
  --max-nodes=5 \
  --zone=$ZONE
```

---

## 15. Security Best Practices

### Enable Workload Identity

```bash
gcloud container clusters update popquiz-cluster \
  --workload-pool=YOUR_PROJECT_ID.svc.id.goog \
  --zone=$ZONE
```

### Enable Network Policies

```bash
gcloud container clusters update popquiz-cluster \
  --enable-network-policy \
  --zone=$ZONE
```

### Rotate Credentials

```bash
gcloud container clusters update popquiz-cluster \
  --start-credential-rotation \
  --zone=$ZONE
```

---

## Common Issues & Solutions

### Issue: Pods stuck in Pending

```bash
# Check node resources
kubectl describe nodes

# Check events
kubectl get events -n popquiz

# Solution: Scale cluster or reduce resource requests
```

### Issue: ImagePullBackOff

```bash
# Check image name and tag
kubectl describe pod <pod-name> -n popquiz

# Solution: Verify image exists on Docker Hub
docker pull abhaytopno/popquiz-backend:v4
```

### Issue: CrashLoopBackOff

```bash
# Check logs
kubectl logs <pod-name> -n popquiz

# Solution: Fix application errors or missing env vars
```

---

## Additional Resources

- [GKE Documentation](https://cloud.google.com/kubernetes-engine/docs)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [GCP Free Tier](https://cloud.google.com/free)
- [nip.io Documentation](https://nip.io/)

---

## Quick Reference

```bash
# Common commands
kubectl get pods -n popquiz
kubectl logs -f <pod-name> -n popquiz
kubectl describe pod <pod-name> -n popquiz
kubectl exec -it <pod-name> -n popquiz -- /bin/sh
kubectl delete pod <pod-name> -n popquiz
kubectl rollout restart deployment/<name> -n popquiz

# Cluster info
kubectl cluster-info
kubectl get nodes
kubectl top nodes
kubectl top pods -n popquiz
```
