# Google Kubernetes Engine (GKE) Setup Guide

Complete step-by-step guide to deploy PopQuiz on Google Kubernetes Engine — from zero to a running app.

> **📖 What is GKE?** Google Kubernetes Engine is a managed Kubernetes service on Google Cloud. Google handles the control plane (master nodes), and you only manage your workloads. This guide walks you through every step, assuming you've never used GKE before.

---

## Architecture on GKE

When deployed, your GKE cluster will run these 5 services:

```
Internet → Ingress (NGINX) → Frontend (Next.js, port 3000)
                            → Backend  (Express.js, port 5000) → Redis (port 6379)
                                                                → Langchain (FastAPI, port 8000) → Qdrant (port 6333)
```

---

## Prerequisites

Before you start, you'll need:

- **Google Cloud account** with billing enabled ([Free trial gives you $300 credit](https://cloud.google.com/free))
- **`gcloud` CLI** installed ([Install Guide](https://cloud.google.com/sdk/docs/install))
- **`kubectl`** installed ([Install Guide](https://kubernetes.io/docs/tasks/tools/))
- **Docker images** pushed to Docker Hub (or you can use the pre-built images in the manifests)

---

## 1. Initial GCP Setup

### Authenticate with Google Cloud

This opens your browser to sign in to your Google account:

```bash
gcloud auth login
```

### Set Your Project

Every GCP resource belongs to a project. Set your project ID:

```bash
# Replace with your actual project ID (find it at https://console.cloud.google.com)
gcloud config set project YOUR_PROJECT_ID

# Verify it worked
gcloud config list
```

### Enable Required APIs

GKE needs these APIs turned on (one-time setup):

```bash
gcloud services enable container.googleapis.com      # GKE
gcloud services enable artifactregistry.googleapis.com # Container registry
gcloud services enable compute.googleapis.com         # VMs for nodes
```

> **💡 Tip:** You can check which APIs are enabled at [console.cloud.google.com/apis](https://console.cloud.google.com/apis).

---

## 2. Create GKE Cluster

Choose one of these three options based on your needs:

### Option 1: Standard (Recommended for Learning)

Good balance of cost and performance. 2 nodes give you room for all 5 services.

```bash
ZONE=asia-south1-a  # Mumbai, India (change to a region near you)

gcloud container clusters create popquiz-cluster \
  --zone $ZONE \
  --num-nodes=2 \
  --machine-type=e2-medium \
  --disk-type=pd-standard \
  --disk-size=10GB
```

| Setting | Value | Why |
|---------|-------|-----|
| `e2-medium` | 2 vCPUs, 4 GB RAM each | Enough for all 5 services |
| `pd-standard` | HDD disks | Cheaper, lower quota usage |
| `num-nodes=2` | 2 worker nodes | Room for Redis, Qdrant PVCs and all pods |

### Option 2: SSD Disk (Better Performance)

Same as above but with faster disks — good for Qdrant which does heavy I/O:

```bash
ZONE=asia-south1-a

gcloud container clusters create popquiz-cluster \
  --zone $ZONE \
  --num-nodes=2 \
  --machine-type=e2-medium \
  --disk-type=pd-ssd \
  --disk-size=10GB
```

### Option 3: Minimal (Free Tier Friendly)

Single-node cluster — tight on resources but works for testing:

```bash
ZONE=asia-south1-a

gcloud container clusters create popquiz-cluster \
  --zone $ZONE \
  --num-nodes=1 \
  --machine-type=e2-medium \
  --disk-type=pd-standard \
  --disk-size=10GB
```

> **⚠️ Note:** With 1 node, you may see pods stuck in `Pending` if resources are tight. Consider using `e2-medium` (not `e2-small`) to fit all 5 services.

**⏳ Cluster creation takes 3-5 minutes.** You'll see a progress indicator in the terminal.

---

## 3. Connect to Your Cluster

After the cluster is created, download credentials so `kubectl` can talk to it:

```bash
ZONE=asia-south1-a

gcloud container clusters get-credentials popquiz-cluster --zone $ZONE
```

If prompted to install the auth plugin:

```bash
gcloud components install gke-gcloud-auth-plugin
```

**Verify the connection:**

```bash
# Should show your cluster's API server URL
kubectl cluster-info

# Should show your node(s) with STATUS: Ready
kubectl get nodes
```

---

## 4. Get External IP Address

You need a public IP for your Ingress to work. Here's a quick way to get one:

```bash
# Create a temporary LoadBalancer service
kubectl create service loadbalancer temp-lb --tcp=80:80

# Wait 30-60 seconds, then check for the EXTERNAL-IP
kubectl get service temp-lb
```

Output will look like:

```
NAME      TYPE           CLUSTER-IP     EXTERNAL-IP      PORT(S)        AGE
temp-lb   LoadBalancer   10.x.x.x      35.200.194.226   80:30000/TCP   45s
```

**Save that EXTERNAL-IP** (e.g., `35.200.194.226`) — you'll need it in the next step.

```bash
# Clean up the temporary service
kubectl delete service temp-lb
```

---

## 5. Update Configuration Files

Replace `YOUR_CLUSTER_IP` in all deployment files with your actual external IP.

### Files to Update

| File | What to Replace |
|------|----------------|
| `k8s/base/ingress.yml` | The `host:` field |
| `k8s/blue-green/ingress.yml` | The `host:` field |
| `k8s/canary/ingress-stable.yml` | The `host:` field |
| `k8s/canary/ingress-canary.yml` | The `host:` field |
| `k8s/.env.backend` | `CORS_ORIGIN`, `COOKIE_DOMAIN` |
| `k8s/.env.frontend` | All `*_URL` variables |

**Example:** Replace `YOUR_CLUSTER_IP.nip.io` with `35.200.194.226.nip.io`

> **What is nip.io?** It's a free wildcard DNS service. `35.200.194.226.nip.io` automatically resolves to `35.200.194.226`. This means you don't need to buy a domain name for testing.

**Using sed (Linux/Mac/WSL):**

```bash
IP="35.200.194.226"
find k8s -name "*.yml" -type f -exec sed -i "s/YOUR_CLUSTER_IP.nip.io/${IP}.nip.io/g" {} +
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

```bash
cd k8s

# Copy the example files
cp .env.example.backend .env.backend
cp .env.example.frontend .env.frontend
cp .env.example.langchain .env.langchain
```

### Edit Each File

**`.env.backend`** — fill in your real values:

```bash
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/popquiz
PORT=5000
CORS_ORIGIN=https://YOUR_IP.nip.io
JWT_SECRET=your-random-secret-key-min-32-characters
NODE_ENV=production
GROQ_API_KEY=gsk_your_groq_api_key_here
REDIS_URL=redis://popquiz-redis:6379
COOKIE_SECURE=true
COOKIE_SAMESITE=none
COOKIE_DOMAIN=YOUR_IP.nip.io
LANGCHAIN_SERVICE_URL=http://popquiz-langchain
```

**`.env.frontend`** — set the URLs to your cluster IP:

```bash
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://YOUR_IP.nip.io
NEXT_PUBLIC_SOCKET_URL=https://YOUR_IP.nip.io
API_URL=http://popquiz-backend
SOCKET_URL=http://popquiz-backend
INTERNAL_API_URL=http://popquiz-backend
```

**`.env.langchain`** — set your Gemini API key:

```bash
GOOGLE_API_KEY=your_google_api_key_here
GEMINI_MODEL=gemini-2.0-flash
GEMINI_EMBED_MODEL=models/gemini-embedding-exp-03-07
QDRANT_URL=http://popquiz-qdrant:6333
HOST=0.0.0.0
PORT=8000
ALLOWED_ORIGINS_STR=https://YOUR_IP.nip.io,http://popquiz-backend
```

### Create Kubernetes Secrets and ConfigMaps

```bash
# Create the namespace
kubectl create namespace popquiz

# Backend secrets (sensitive: DB credentials, JWT, API keys)
kubectl create secret generic backend-secrets \
  --from-env-file=.env.backend \
  --namespace=popquiz

# Frontend config (non-sensitive: public URLs)
kubectl create configmap frontend-secrets \
  --from-env-file=.env.frontend \
  --namespace=popquiz

# Langchain secrets (sensitive: Gemini API key)
kubectl create secret generic langchain-secrets \
  --from-env-file=.env.langchain \
  --namespace=popquiz
```

**Verify:**

```bash
kubectl get secrets,configmaps -n popquiz
# You should see: backend-secrets, langchain-secrets, frontend-secrets
```

> **⚠️ Security:** Never commit your actual `.env.backend`, `.env.frontend`, or `.env.langchain` files to Git! They are already in `.gitignore`.

---

## 7. Deploy to GKE

### Deploy Base Configuration

This single command deploys all 5 services (Redis, Qdrant, Langchain, Backend, Frontend):

```bash
kubectl apply -f base/
```

> **What does `kubectl apply -f base/` do?** It reads every `.yml` file in the `base/` directory and creates/updates the resources defined in them.

### Verify Deployment

```bash
# Check all resources at a glance
kubectl get all -n popquiz
```

**Check pods individually** — all 5 should show `Running`:

```bash
kubectl get pods -n popquiz
```

Expected output:

```
NAME                                          READY   STATUS    AGE
popquiz-langchain-xxxxx                       1/1     Running   60s
popquiz-backend-xxxxx                         1/1     Running   60s
popquiz-frontend-xxxxx                        1/1     Running   60s
popquiz-qdrant-0                              1/1     Running   60s
popquiz-redis-0                               1/1     Running   60s
```

**Check services:**

```bash
kubectl get svc -n popquiz
```

Expected — 5 services:

```
NAME                       TYPE        CLUSTER-IP     PORT(S)
popquiz-langchain          ClusterIP   10.x.x.x      80/TCP
popquiz-backend            ClusterIP   10.x.x.x      80/TCP
popquiz-frontend           ClusterIP   10.x.x.x      80/TCP
popquiz-qdrant             ClusterIP   None           6333/TCP,6334/TCP
popquiz-redis              ClusterIP   None           6379/TCP
```

**Check ingress:**

```bash
kubectl get ingress -n popquiz
```

### View Logs

If something isn't working, check the logs:

```bash
# Backend logs
kubectl logs -f deployment/popquiz-backend -n popquiz

# Frontend logs
kubectl logs -f deployment/popquiz-frontend -n popquiz

# Langchain logs
kubectl logs -f deployment/popquiz-langchain -n popquiz

# Qdrant logs (StatefulSet — use pod name directly)
kubectl logs -f popquiz-qdrant-0 -n popquiz

# Redis logs
kubectl logs -f popquiz-redis-0 -n popquiz
```

> **💡 Tip:** The `-f` flag streams logs in real-time. Press `Ctrl+C` to stop.

---

## 8. Access Your Application

After deployment, access your app at:

```
http://YOUR_EXTERNAL_IP.nip.io
```

Example: `http://35.200.194.226.nip.io`

> **What is `.nip.io`?** It's a free wildcard DNS service. Any subdomain of `nip.io` resolves to the IP address embedded in the hostname. So `35.200.194.226.nip.io` resolves to `35.200.194.226`.

**Quick health checks:**

```bash
# Test frontend (should return HTML)
curl -s http://YOUR_IP.nip.io | head -5

# Test backend API (should return JSON)
curl -s http://YOUR_IP.nip.io/api/health
```

---

## 9. Deployment Strategies

Once the base deployment is running, you can try advanced strategies.

### Blue-Green Deployment

Zero-downtime deployment by running two environments and switching traffic:

```bash
# Step 1: Deploy blue version + services + ingress
kubectl apply -f blue-green/deployment-blue.yml
kubectl apply -f blue-green/service.yml
kubectl apply -f blue-green/ingress.yml

# Step 2: Verify blue is live
kubectl get ingress popquiz-ingress -n popquiz \
  -o jsonpath='{.spec.rules[0].http.paths[0].backend.service.name}'
# Expected: popquiz-backend-blue

# Step 3: Deploy green (idle — no traffic yet)
kubectl apply -f blue-green/deployment-green.yml

# Step 4: Switch traffic to green
kubectl patch ingress popquiz-ingress -n popquiz --type='json' -p='[
  {"op": "replace", "path": "/spec/rules/0/http/paths/0/backend/service/name", "value": "popquiz-backend-green"},
  {"op": "replace", "path": "/spec/rules/0/http/paths/1/backend/service/name", "value": "popquiz-backend-green"},
  {"op": "replace", "path": "/spec/rules/0/http/paths/2/backend/service/name", "value": "popquiz-frontend-green"}
]'
```

### Canary Deployment

Gradually shift traffic from stable to canary:

```bash
# Step 1: Deploy stable version + services + ingress
kubectl apply -f canary/deployment-stable.yml
kubectl apply -f canary/service.yml
kubectl apply -f canary/ingress-stable.yml

# Step 2: Deploy canary version (no traffic yet)
kubectl apply -f canary/deployment-canary.yml

# Step 3: Start canary rollout (10% traffic)
kubectl apply -f canary/ingress-canary.yml

# Step 4: Monitor canary logs for errors
kubectl logs -f deployment/popquiz-backend-canary -n popquiz
kubectl logs -f deployment/popquiz-langchain-canary -n popquiz

# Step 5: Increase traffic — edit ingress-canary.yml and change canary-weight to 25, 50, 100
```

---

## 10. Monitoring & Troubleshooting

### Check Pod Status

```bash
# Real-time updates (Ctrl+C to stop)
kubectl get pods -n popquiz -w
```

### Describe Pod (for errors)

When a pod isn't starting, `describe` shows Events at the bottom — that's where errors are:

```bash
kubectl describe pod <pod-name> -n popquiz
```

### View Events

See the most recent cluster events (scheduling, pulling images, errors):

```bash
kubectl get events -n popquiz --sort-by='.lastTimestamp'
```

### Shell into Pod

Open an interactive shell inside any pod for debugging:

```bash
# Backend pod
kubectl exec -it <pod-name> -n popquiz -- sh

# Test internal connectivity from inside
apk add curl
curl http://popquiz-langchain/docs     # Should return Langchain API docs
curl http://redis:6379                  # Should get a Redis protocol error (means it's reachable)
curl http://qdrant:6333/collections    # Should return Qdrant collections JSON
```

### Port Forward (for local testing)

Access internal services from your local machine without Ingress:

```bash
# Backend API on localhost:5000
kubectl port-forward svc/popquiz-backend 5000:80 -n popquiz

# Frontend on localhost:3000
kubectl port-forward svc/popquiz-frontend 3000:80 -n popquiz

# Langchain API docs on localhost:8000
kubectl port-forward svc/popquiz-langchain 8000:80 -n popquiz

# Qdrant dashboard on localhost:6333
kubectl port-forward svc/qdrant 6333:6333 -n popquiz
```

### Common Pod Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `Pending` | Not enough CPU/memory on nodes | Scale cluster or reduce resource requests |
| `ImagePullBackOff` | Image name/tag wrong or doesn't exist | `kubectl describe pod <name> -n popquiz` → check image |
| `CrashLoopBackOff` | App crashes on start (missing env vars, bad config) | `kubectl logs <name> -n popquiz` → read error message |
| `CreateContainerConfigError` | Secret or ConfigMap doesn't exist | `kubectl get secrets,configmaps -n popquiz` → verify names |

---

## 11. Scaling

### Manual Scaling

```bash
# Scale backend to 3 replicas
kubectl scale deployment popquiz-backend-deployment --replicas=3 -n popquiz

# Scale frontend to 3 replicas
kubectl scale deployment popquiz-frontend-deployment --replicas=3 -n popquiz

# Scale langchain to 2 replicas
kubectl scale deployment langchain-deployment --replicas=2 -n popquiz
```

> **📝 Note:** Redis and Qdrant are StatefulSets. You _can_ scale them, but vector databases and caches need special care (data sharding). For most use cases, 1 replica is fine.

### Auto-scaling

```bash
# Horizontal Pod Autoscaler — adds/removes pods based on CPU
kubectl apply -f autoscaling/hpa.yml

# Vertical Pod Autoscaler — adjusts CPU/memory requests (requires VPA controller)
kubectl apply -f autoscaling/vpa.yml

# Verify HPAs
kubectl get hpa -n popquiz
```

### Enable GKE Cluster Autoscaler

This automatically adds/removes **nodes** (VMs) when pods can't be scheduled:

```bash
gcloud container clusters update popquiz-cluster \
  --enable-autoscaling \
  --min-nodes=1 \
  --max-nodes=5 \
  --zone=$ZONE
```

---

## 12. Updates & Rollbacks

### Update Image Version

```bash
# Update backend to a new version
kubectl set image deployment/popquiz-backend-deployment \
  popquiz-backend=abhaytopno/popquiz-backend:v13 \
  -n popquiz

# Update langchain
kubectl set image deployment/langchain-deployment \
  langchain=abhaytopno/popquiz-langchain:v2 \
  -n popquiz
```

### Check Rollout Status

```bash
kubectl rollout status deployment/popquiz-backend-deployment -n popquiz
# "deployment successfully rolled out" means it's done
```

### Rollback

If something goes wrong, instantly revert:

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
kubectl delete -f base/ -n popquiz
```

### Delete the Entire Namespace (removes everything in it)

```bash
kubectl delete namespace popquiz
```

### Delete the GKE Cluster (stops all billing)

```bash
ZONE=asia-south1-a

gcloud container clusters delete popquiz-cluster \
  --zone $ZONE \
  --quiet
```

> **⚠️ Important:** Deleting the cluster removes all nodes, pods, and data. Make sure you've backed up anything you need (e.g., Qdrant vector data, Redis state).

---

## 14. Cost Optimization

### Use Preemptible/Spot Nodes (60-80% cheaper)

These nodes can be reclaimed by Google with 30 seconds notice, but are much cheaper:

```bash
gcloud container node-pools create spot-pool \
  --cluster=popquiz-cluster \
  --zone=$ZONE \
  --spot \
  --machine-type=e2-medium \
  --num-nodes=2
```

> **Good for:** Stateless services (Frontend, Backend, Langchain). **Not recommended for:** Redis and Qdrant (stateful — you'd lose data).

### Check Cluster Cost

```bash
gcloud container clusters describe popquiz-cluster \
  --zone $ZONE \
  --format="value(currentMasterVersion,currentNodeCount)"
```

---

## 15. Security Best Practices

### Enable Workload Identity

Removes the need to store GCP credentials in pods:

```bash
gcloud container clusters update popquiz-cluster \
  --workload-pool=YOUR_PROJECT_ID.svc.id.goog \
  --zone=$ZONE
```

### Enable Network Policies

Control which pods can talk to each other:

```bash
gcloud container clusters update popquiz-cluster \
  --enable-network-policy \
  --zone=$ZONE
```

### Rotate Credentials

Periodically rotate cluster credentials:

```bash
gcloud container clusters update popquiz-cluster \
  --start-credential-rotation \
  --zone=$ZONE
```

---

## Quick Reference

```bash
# ── Cluster ──
kubectl cluster-info
kubectl get nodes
kubectl top nodes                                    # CPU/memory per node

# ── All resources ──
kubectl get all -n popquiz

# ── Pods ──
kubectl get pods -n popquiz                          # List all pods
kubectl logs -f <pod-name> -n popquiz                # Stream logs
kubectl describe pod <pod-name> -n popquiz           # Events + details
kubectl exec -it <pod-name> -n popquiz -- sh         # Shell into pod
kubectl delete pod <pod-name> -n popquiz             # Delete (will restart)
kubectl top pods -n popquiz                          # CPU/memory per pod

# ── Deployments ──
kubectl rollout restart deployment/<name> -n popquiz # Restart pods
kubectl rollout undo deployment/<name> -n popquiz    # Rollback
kubectl scale deployment/<name> --replicas=3 -n popquiz

# ── Secrets (verify, don't print values) ──
kubectl get secrets -n popquiz
kubectl describe secret backend-secrets -n popquiz
kubectl describe secret langchain-secrets -n popquiz
```

---

## Additional Resources

| Resource | Link |
|----------|------|
| GKE Documentation | [cloud.google.com/kubernetes-engine/docs](https://cloud.google.com/kubernetes-engine/docs) |
| kubectl Cheat Sheet | [kubernetes.io/docs/reference/kubectl/cheatsheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/) |
| GCP Free Tier | [cloud.google.com/free](https://cloud.google.com/free) |
| nip.io Documentation | [nip.io](https://nip.io/) |
| PopQuiz README | [README.md](README.md) |
