# Amazon Elastic Kubernetes Service (EKS) Setup Guide

Complete step-by-step guide to deploy PopQuiz on Amazon EKS — from zero to a running app on Ubuntu/Linux.

> **📖 What is EKS?** Amazon Elastic Kubernetes Service is a managed Kubernetes service on AWS. Amazon handles the control plane (master nodes), and you only manage your workloads. This guide walks you through every step, assuming you've never used EKS before.

---

## Architecture on EKS

When deployed, your EKS cluster will run these 5 services:

```text
                  [ Internet ]
                       │
                       ▼
            [ Network Load Balancer ]
                       │
                       ▼
          [ NGINX Ingress Controller ]
             (Routes / to Frontend,
              /api to Backend)
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
    [ Frontend ]               [ Backend ]
     (Next.js)                (Express.js)
    (port 3000)                (port 5000)
                                    │
                       ┌────────────┴────────────┐
                       ▼                         ▼
                   [ Redis ]               [ Langchain ]
                    (Cache)                  (FastAPI)
                  (port 6379)               (port 8000)
                                                 │
                                                 ▼
                                            [ Qdrant ]
                                           (Vector DB)
                                           (port 6333)
```

---

## Prerequisites

Before you start, you'll need:

- **AWS account** with billing enabled ([Free Tier gives you 12 months](https://aws.amazon.com/free/))
- **Ubuntu/Linux machine** (or WSL2 on Windows)
- **`aws` CLI** installed and configured
- **`eksctl`** installed (the official EKS cluster management tool)
- **`kubectl`** installed
- **`helm`** installed (for Deployment, NGINX Ingress Controller and the Prometheus/Grafana monitoring stack)


For Helm deployments, also make sure the `popquiz` namespace exists and the
`backend-secrets`, `langchain-secrets`, and `frontend-secrets` Secret/ConfigMap
resources have been created as described in Step 9. The chart deliberately
does not store application credentials or generate those resources.

---

## 1. Install Required Tools (Ubuntu/Linux)

### Install AWS CLI v2

```bash
# Download the installer
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"

# Unzip
unzip awscliv2.zip

# Install
sudo ./aws/install

# Verify
aws --version
# Expected: aws-cli/2.x.x Python/3.x.x Linux/...

# Clean up
rm -rf awscliv2.zip aws/
```

### Install eksctl

`eksctl` is the official CLI tool for creating and managing EKS clusters:

```bash
# Download the latest eksctl binary
ARCH=amd64
PLATFORM=$(uname -s)_$ARCH
curl -sLO "https://github.com/eksctl-io/eksctl/releases/latest/download/eksctl_${PLATFORM}.tar.gz"

# Extract and install
tar -xzf eksctl_${PLATFORM}.tar.gz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

# Verify
eksctl version

# Clean up
rm eksctl_${PLATFORM}.tar.gz
```

### Install kubectl

```bash
# Get the latest stable version number
K8S_VERSION=$(curl -L -s https://dl.k8s.io/release/stable.txt)

# Download kubectl
curl -LO "https://dl.k8s.io/release/${K8S_VERSION}/bin/linux/amd64/kubectl"

# Install
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Verify
kubectl version --client

# Clean up
rm kubectl
```

### Install Helm

Helm is a package manager for Kubernetes — you'll use it to install the NGINX Ingress Controller:

```bash
# Download the Helm installer
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Verify
helm version
```

---

## 2. Configure AWS CLI & IAM

### Create an IAM User for EKS (Recommended)

> **⚠️ Security:** Never use your root AWS account for everyday tasks. Create a dedicated IAM user with limited permissions.

1. Go to [IAM Console → Users → Create User](https://console.aws.amazon.com/iam/home#/users)
2. **Username:** `eks-admin`
3. **Permissions:** Attach these managed policies:
   - `AmazonEKSClusterPolicy`
   - `AmazonEKSWorkerNodePolicy`
   - `AmazonEC2ContainerRegistryReadOnly`
   - `AmazonVPCFullAccess`
   - `IAMFullAccess` *(needed for eksctl to create node roles)*
   - `AmazonEC2FullAccess`
   - `CloudFormationFullAccess` *(eksctl uses CloudFormation internally)*
4. Create the user and generate **Access Keys** (type: CLI)

> **💡 Alternative:** If you're on an EC2 instance or Cloud9, attach an IAM Role to the instance instead of using Access Keys — this is more secure and avoids managing long-lived credentials.

### Configure AWS CLI

```bash
aws configure
```

You'll be prompted for:

```
AWS Access Key ID [None]:     AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region name [None]:   ap-south-1        # Mumbai (change to your region)
Default output format [None]: json
```

**Verify authentication:**

```bash
aws sts get-caller-identity
```

Expected output:

```json
{
    "UserId": "AIDA...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/eks-admin"
}
```

---

## 3. Create IAM Roles for EKS

`eksctl` creates most required roles automatically. Here is what gets created:

### Roles Created Automatically by eksctl

| Role | Purpose |
|------|---------|
| `eksctl-popquiz-cluster-cluster-ServiceRole` | Control plane role — allows EKS to manage AWS resources |
| `eksctl-popquiz-cluster-nodegroup-NodeInstanceRole` | Node role — allows worker nodes to join the cluster and pull ECR images |

### Additional Role: EBS CSI Driver (Required for PersistentVolumes)

EKS uses the EBS CSI driver to provision storage for Redis and Qdrant. This is set up in Step 6 after cluster creation.

### Verify Your IAM Permissions Before Creating the Cluster

```bash
aws iam list-attached-user-policies --user-name eks-admin
```

---

## 4. Create EKS Cluster

Choose one of these three options based on your needs:

### Option 1: Standard (Recommended for Learning)

Good balance of cost and performance. 2 nodes give you room for all 5 services:

```bash
REGION=ap-south-1   # Mumbai, India (change to a region near you)
CLUSTER_NAME=popquiz-cluster

eksctl create cluster \
  --name $CLUSTER_NAME \
  --region $REGION \
  --nodegroup-name popquiz-nodes \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 4 \
  --managed \
  --with-oidc
```

> **💡 `--with-oidc`** enables the OIDC provider at cluster creation time. This is required for the EBS CSI driver IAM setup (Step 6) and avoids a warning about vpc-cni permissions.

| Setting | Value | Why |
|---------|-------|-----|
| `t3.medium` | 2 vCPUs, 4 GB RAM each | Enough for all 5 services |
| `--nodes 2` | 2 worker nodes | Room for Redis, Qdrant PVCs and all pods |
| `--managed` | EKS-managed node group | AWS handles node patching and updates |

### Option 2: Spot Instances (60-70% cheaper)

Uses AWS Spot Instances — same capacity but at a steep discount. Good for dev/staging:

```bash
REGION=ap-south-1
CLUSTER_NAME=popquiz-cluster

eksctl create cluster \
  --name $CLUSTER_NAME \
  --region $REGION \
  --nodegroup-name popquiz-spot-nodes \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 4 \
  --spot \
  --managed \
  --with-oidc
```

> **⚠️ Note:** Spot instances can be terminated by AWS with 2-minute notice. Use On-Demand nodes for Redis and Qdrant (stateful) in production.

### Option 3: Minimal (Free Tier Friendly)

Single node — tight on resources but works for testing:

```bash
REGION=ap-south-1
CLUSTER_NAME=popquiz-cluster

eksctl create cluster \
  --name $CLUSTER_NAME \
  --region $REGION \
  --nodegroup-name popquiz-nodes \
  --node-type t3.micro \
  --nodes 3 \
  --nodes-min 1 \
  --nodes-max 5 \
  --managed \
  --with-oidc
```

> **⚠️ Note:** With 1 node, you may see pods stuck in `Pending` if resources are tight.

**⏳ Cluster creation takes 15-20 minutes.** eksctl uses CloudFormation under the hood. Watch progress:

```bash
# In another terminal, watch CloudFormation stacks being created
aws cloudformation list-stacks \
  --stack-status-filter CREATE_IN_PROGRESS \
  --region $REGION \
  --query 'StackSummaries[].StackName'
```

---

## 5. Connect to Your Cluster

After the cluster is created, `eksctl` automatically updates your kubeconfig. Verify:

```bash
# Should show your cluster's API server URL
kubectl cluster-info

# Should show your node(s) with STATUS: Ready
kubectl get nodes
```

If kubeconfig was not updated automatically:

```bash
aws eks update-kubeconfig \
  --name popquiz-cluster \
  --region ap-south-1
```

**Verify the connection:**

```bash
kubectl get nodes -o wide
```

Expected output:

```
NAME                                          STATUS   ROLES    AGE   VERSION
ip-192-168-x-x.ap-south-1.compute.internal   Ready    <none>   5m    v1.xx.x-eks-...
ip-192-168-x-x.ap-south-1.compute.internal   Ready    <none>   5m    v1.xx.x-eks-...
```

---

## 6. Install Required Add-ons

### Install the EBS CSI Driver (Required for PersistentVolumes)

Redis and Qdrant use PersistentVolumes — EKS needs the EBS CSI driver to provision EBS volumes.

**Step 1: Create an IAM OIDC provider for your cluster** (enables pods to assume IAM roles via IRSA):

```bash
eksctl utils associate-iam-oidc-provider \
  --cluster popquiz-cluster \
  --region ap-south-1 \
  --approve
```

**Step 2: Create an IAM service account for the EBS CSI driver:**

```bash
eksctl create iamserviceaccount \
  --name ebs-csi-controller-sa \
  --namespace kube-system \
  --cluster popquiz-cluster \
  --region ap-south-1 \
  --role-name AmazonEKS_EBS_CSI_DriverRole \
  --role-only \
  --attach-policy-arn arn:aws:iam::aws:policy/service-role/AmazonEBSCSIDriverPolicy \
  --approve
```

**Step 3: Install the EBS CSI driver add-on:**

```bash
# Get your AWS account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=ap-south-1

aws eks create-addon \
  --cluster-name popquiz-cluster \
  --addon-name aws-ebs-csi-driver \
  --service-account-role-arn arn:aws:iam::${ACCOUNT_ID}:role/AmazonEKS_EBS_CSI_DriverRole \
  --region $REGION

# Verify the add-on is active (~60 seconds)
aws eks describe-addon \
  --cluster-name popquiz-cluster \
  --addon-name aws-ebs-csi-driver \
  --region $REGION \
  --query 'addon.status'
# Expected: "ACTIVE"
```

**Step 4: Set the default StorageClass to gp2:**

```bash
# Verify a default StorageClass exists
kubectl get storageclass

# If gp2 is not the default, set it
kubectl patch storageclass gp2 \
  -p '{"metadata": {"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

### Install NGINX Ingress Controller

EKS doesn't include an Ingress controller. Install NGINX using Helm:

```bash
# Add the ingress-nginx Helm repo
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

# Install — this creates an AWS Network Load Balancer automatically
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer

# Wait for the Load Balancer to get an external hostname (~60-90 seconds)
kubectl get svc -n ingress-nginx ingress-nginx-controller -w
```

Wait until `EXTERNAL-IP` shows a hostname (not `<pending>`):

```
NAME                       TYPE           CLUSTER-IP     EXTERNAL-IP                                              PORT(S)
ingress-nginx-controller   LoadBalancer   10.100.x.x    a1b2c3d4.ap-south-1.elb.amazonaws.com   80:30xxx/TCP,443:30xxx/TCP
```

> **💡 Note:** AWS gives you a DNS hostname (not a raw IP) for the Load Balancer. This hostname resolves to the Load Balancer's public IPs.

The base, blue-green, canary, and Helm ingress manifests all route `/api` and
`/socket.io` to the backend and `/` to the frontend. Keep the explicit
`/socket.io` path: Socket.IO upgrades connections through that path and will
otherwise be sent to the frontend. The manifests also enable
`use-forwarded-headers` and `compute-full-forwarded-for` so backend rate
limiting sees the browser's real client IP instead of the NLB address.

### Open Node Security Group for Port 80/443

> **⚠️ Required:** AWS NLBs pass traffic directly to worker node EC2 instances. The node security group must explicitly allow inbound port 80 and 443 or your app will be unreachable (`ERR_CONNECTION_TIMED_OUT`).

```bash
# Find the cluster shared security group (attached to all worker nodes)
# It is named: eks-cluster-sg-popquiz-cluster-XXXXXXXXXX
SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=tag:aws:eks:cluster-name,Values=popquiz-cluster" \
  --query 'SecurityGroups[0].GroupId' \
  --output text \
  --region ap-south-1)

echo "Cluster Security Group: $SG_ID"

# Allow HTTP from anywhere
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 80 \
  --cidr 0.0.0.0/0 \
  --region ap-south-1

# Allow HTTPS from anywhere
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0 \
  --region ap-south-1

# Allow the NodePort range (NLB routes through these)
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 30000-32767 \
  --cidr 0.0.0.0/0 \
  --region ap-south-1
```

---

## 7. Get External Hostname / IP Address

```bash
# Get the Load Balancer hostname
LB_HOSTNAME=$(kubectl get svc ingress-nginx-controller \
  -n ingress-nginx \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

echo "Your Load Balancer hostname: $LB_HOSTNAME"
# Example: a1b2c3d4e5f6g7h8.ap-south-1.elb.amazonaws.com
```

**Save the hostname** — you'll need it in the next step.

> **Using nip.io (no custom domain needed):** Resolve the LB hostname to an IP first:
> ```bash
> # Resolve the hostname to an IP (use any of the returned IPs)
> dig +short $LB_HOSTNAME | head -1
> # Example output: 13.126.100.200
> ```
> Then use `13.126.100.200.nip.io` as your domain — it's a free wildcard DNS service.

---

## 8. Setup Environment Variables

### Create Your Environment Files

```bash
cd k8s

# Copy the example files
cp .env.example.backend .env.backend
cp .env.example.frontend .env.frontend
cp .env.example.langchain .env.langchain
```

### Edit Each File

Replace `YOUR_NLB_HOSTNAME` with your actual NLB hostname from Step 8 (e.g., `a46de63d...ap-south-1.elb.amazonaws.com`):

**`.env.backend`** — fill in your real values:

```bash
MONGO_URI=mongodb://url/popquiz
PORT=5000
CORS_ORIGIN=http://YOUR_NLB_HOSTNAME
JWT_SECRET=your-random-secret-key-min-32-characters
NODE_ENV=production
GROQ_API_KEY=gsk_your_groq_api_key_here
REDIS_URL=redis://popquiz-redis:6379
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
COOKIE_DOMAIN=YOUR_NLB_HOSTNAME
LANGCHAIN_SERVICE_URL=http://popquiz-langchain
```

> **💡 Note:** Use `COOKIE_SECURE=false` and `COOKIE_SAMESITE=lax` when accessing over plain HTTP. If you later add TLS, switch back to `true` and `none`.

**`.env.frontend`** — set the URLs to your NLB hostname:

```bash
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://YOUR_NLB_HOSTNAME
NEXT_PUBLIC_SOCKET_URL=http://YOUR_NLB_HOSTNAME
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
ALLOWED_ORIGINS_STR=http://YOUR_NLB_HOSTNAME,http://popquiz-backend
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

## 9. Deploy to EKS

### Step 1: Deploy the Database Infrastructure (Tier 1)

Before deploying your applications, you must deploy the foundational databases (Redis and Qdrant). We use Helm for this because setting up highly available clustered databases requires it.

```bash
# 1. Download the database charts
helm dependency update helm/infrastructure

# 2. Deploy the databases
helm upgrade --install infra helm/infrastructure -n popquiz
```
Wait a moment for the database pods to start up.

### Step 2: Deploy Base Application Configuration

This command deploys your 3 stateless app services (Langchain, Backend, Frontend) using Helm. They will automatically connect to the databases from Step 1.

```bash
helm upgrade --install popquiz-release helm/popquiz-chart -n popquiz
```

> **What does this do?** It uses the `popquiz-chart` Helm chart to generate and deploy all necessary Kubernetes resources for your frontend, backend, and langchain services in the `popquiz` namespace.

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
```

**Check services:**

```bash
kubectl get svc -n popquiz
```

Expected — 3 services (plus the database services from your infra chart):

```
NAME                       TYPE        CLUSTER-IP     PORT(S)
popquiz-langchain          ClusterIP   10.x.x.x      80/TCP
popquiz-backend            ClusterIP   10.x.x.x      80/TCP
popquiz-frontend           ClusterIP   10.x.x.x      80/TCP
```

**Check ingress:**

```bash
kubectl get ingress -n popquiz
```

---

## 10. Access Your Application

After deployment, access your app directly via the NLB hostname on port 80:

```
http://YOUR_NLB_HOSTNAME
```

Example: `http://a46de63d8a83a4d3ea96cdb894d98990-147557283.ap-south-1.elb.amazonaws.com`

> **⚠️ Don't add a port number.** The NLB listens on port 80 — accessing `:3000` or `:5000` directly bypasses the ingress and will time out.

> **💡 Tip:** AWS NLB DNS names can take 1-2 minutes to propagate globally. If the hostname doesn't resolve yet, wait a moment and retry.

**Quick health checks:**

```bash
LB=$(kubectl get svc ingress-nginx-controller -n ingress-nginx \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

# Test frontend (should return HTML)
curl -I http://$LB

# Test backend API (should return JSON)
curl -s http://$LB/api/health
```

---

## 11. Deployment Strategies

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

## 12. Monitoring with Prometheus and Grafana

Install the Kubernetes-native monitoring stack to track CPU, memory, pod counts, restarts, and crash states for PopQuiz in Grafana dashboards.

### Step 1: Install Prometheus + Grafana

The `kube-prometheus-stack` Helm chart bundles Prometheus, Grafana, Alertmanager, node-exporter, and kube-state-metrics:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

kubectl create namespace monitoring

helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring
```

> **⏳ Note:** This can take 1-2 minutes for all pods to become `Running`. The stack adds real CPU/memory pressure on top of the 5 PopQuiz services — on a 2-node `t3.medium` cluster, watch for `Pending` pods and scale the node group if needed (`eksctl scale nodegroup --cluster popquiz-cluster --name popquiz-nodes --nodes 3 --region ap-south-1`).

### Step 2: Install Metrics Server

Metrics Server powers `kubectl top` and feeds the HPA (§15) with real CPU/memory percentages:

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

> **⚠️ EKS gotcha:** Metrics Server often sits in `CrashLoopBackOff` on EKS with `x509: cannot validate certificate` errors, because managed-node kubelet certificates aren't valid for the address Metrics Server connects to. Fix by allowing insecure TLS to the kubelet:
> ```bash
> kubectl patch deployment metrics-server -n kube-system --type='json' \
>   -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
> ```

### Step 3: Verify the Monitoring Stack

```bash
kubectl get pods -n monitoring
kubectl get pods -n kube-system | grep metrics-server
kubectl top nodes
kubectl top pods -n popquiz
```

Wait until every pod in the `monitoring` namespace and the Metrics Server show `Running` before continuing.

### Step 4: Open Grafana

**Option A — Port-forward (quickest, local machine only):**

```bash
kubectl port-forward svc/prometheus-grafana -n monitoring 3001:80
```

Open `http://localhost:3001`.

**Option B — Expose via LoadBalancer (reachable from anywhere):**

```bash
kubectl patch svc prometheus-grafana -n monitoring -p '{"spec": {"type": "LoadBalancer"}}'

# Wait for EXTERNAL-IP/hostname to be assigned (~60-90 seconds)
kubectl get svc prometheus-grafana -n monitoring -w
```

Once `EXTERNAL-IP` shows a hostname, fetch it and open it on port 80 from any machine/network:

```bash
GRAFANA_LB=$(kubectl get svc prometheus-grafana -n monitoring \
  -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')

echo "Grafana: http://$GRAFANA_LB"
```

> **⚠️ Security:** This puts Grafana's login page on the open internet. Change the default admin password immediately (below). To restrict *who* can reach it, set `loadBalancerSourceRanges` on the Service — unlike §6's node security group (shared with the public app, so it can't be locked down per-service), this is enforced on Grafana's own Load Balancer:
> ```bash
> MY_IP=$(curl -s https://checkip.amazonaws.com)/32
>
> kubectl patch svc prometheus-grafana -n monitoring -p \
>   "{\"spec\": {\"loadBalancerSourceRanges\": [\"$MY_IP\"]}}"
> ```
> Add more CIDRs to the list (teammates, office/VPN ranges) as needed — omit this and anyone with the URL can reach the login page, so keep a strong admin password either way.

Log in with:

- **Username:** `admin`
- **Password:**

```bash
kubectl get secret --namespace monitoring prometheus-grafana \
  -o jsonpath="{.data.admin-password}" | base64 --decode
```

### Step 5: Import a Dashboard in Grafana

You can easily import a community-built Kubernetes dashboard instead of creating panels from scratch:

1. Go to [Grafana Dashboards](https://grafana.com/grafana/dashboards/) to find a dashboard you like (e.g., search for "Kubernetes Cluster" or "EKS").
2. Copy the Dashboard ID (e.g., `315` or `15757`).
3. In your Grafana UI, click the **+ (Plus)** icon in the left sidebar and select **Import**.
4. Paste the Dashboard ID and click **Load**.
5. Select `Prometheus` as your data source from the dropdown and click **Import**.


---

## 13. Scaling

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

### Auto-scaling (HPA)

```bash
# Horizontal Pod Autoscaler — adds/removes pods based on CPU
kubectl apply -f autoscaling/hpa.yml

# Vertical Pod Autoscaler — adjusts CPU/memory requests
kubectl apply -f autoscaling/vpa.yml

# Verify HPAs
kubectl get hpa -n popquiz
```

> **📝 Note:** If `TARGETS` shows `<unknown>/50%` instead of a real percentage, Metrics Server isn't installed yet — see §14.

### Enable EKS Cluster Autoscaler

This automatically adds/removes **EC2 nodes** when pods can't be scheduled.

**Step 1: Create IAM policy for Cluster Autoscaler:**

```bash
# Download the policy document
curl -o cluster-autoscaler-policy.json \
  https://raw.githubusercontent.com/kubernetes/autoscaler/master/cluster-autoscaler/cloudprovider/aws/examples/cluster-autoscaler-autodiscover.json

# Create the IAM policy
aws iam create-policy \
  --policy-name AmazonEKSClusterAutoscalerPolicy \
  --policy-document file://cluster-autoscaler-policy.json

rm cluster-autoscaler-policy.json
```

**Step 2: Create IAM service account for Cluster Autoscaler:**

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=ap-south-1

eksctl create iamserviceaccount \
  --cluster=popquiz-cluster \
  --namespace=kube-system \
  --name=cluster-autoscaler \
  --attach-policy-arn=arn:aws:iam::${ACCOUNT_ID}:policy/AmazonEKSClusterAutoscalerPolicy \
  --override-existing-serviceaccounts \
  --region $REGION \
  --approve
```

**Step 3: Deploy Cluster Autoscaler:**

```bash
# Deploy the Cluster Autoscaler
kubectl apply -f https://raw.githubusercontent.com/kubernetes/autoscaler/master/cluster-autoscaler/cloudprovider/aws/examples/cluster-autoscaler-autodiscover.yaml

# Annotate to prevent eviction
kubectl patch deployment cluster-autoscaler \
  -n kube-system \
  -p '{"spec":{"template":{"metadata":{"annotations":{"cluster-autoscaler.kubernetes.io/safe-to-evict": "false"}}}}}'

# Set your cluster name
kubectl set env deployment cluster-autoscaler \
  -n kube-system \
  CLUSTER_NAME=popquiz-cluster

# Verify it's running
kubectl get pods -n kube-system | grep cluster-autoscaler
```

---

## 14. Updates & Rollbacks

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

## 15. Cleanup

### Delete Specific Resources

```bash
kubectl delete -f base/ -n popquiz
```

### Delete the Entire Namespace (removes everything in it)

```bash
kubectl delete namespace popquiz
```

### Uninstall NGINX Ingress Controller

```bash
helm uninstall ingress-nginx -n ingress-nginx
```

### Uninstall Monitoring Stack

```bash
helm uninstall prometheus -n monitoring
kubectl delete namespace monitoring
kubectl delete -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

### Delete the EKS Cluster (stops all billing)

```bash
eksctl delete cluster \
  --name popquiz-cluster \
  --region ap-south-1
```

> **⚠️ Important:** Deleting the cluster removes all nodes and pods, but **EBS volumes for PVCs are NOT deleted automatically by default.** Check the AWS Console for orphaned EBS volumes to avoid ongoing storage charges.

**Find and delete orphaned EBS volumes:**

```bash
# List EBS volumes tagged with your cluster
aws ec2 describe-volumes \
  --filters "Name=tag:kubernetes.io/cluster/popquiz-cluster,Values=owned" \
  --query 'Volumes[*].[VolumeId,State]' \
  --region ap-south-1 \
  --output table
```

---

## 16. Autoscaling & Zero-Downtime Updates

### Zero-Downtime Updates

When you update your application code and push a new Docker image with the **same tag** (e.g., `latest`), Kubernetes won't automatically pull it because the deployment manifest hasn't changed. 

To force Kubernetes to pull the new image with **zero downtime**, simply restart the deployment:

```bash
# Restart Backend (zero downtime)
kubectl rollout restart deployment popquiz-backend -n popquiz

# Restart Frontend (zero downtime)
kubectl rollout restart deployment popquiz-frontend -n popquiz
```

Kubernetes will gracefully start new pods, wait for them to become healthy, and only then terminate the old pods.

### Autoscaling Stateless Apps (Tier 2)

Your stateless applications (Frontend, Backend, Langchain) can automatically scale out (add more pods) when CPU or Memory usage gets high using the **Horizontal Pod Autoscaler (HPA)**.

*Prerequisite: The Metrics Server must be installed (see Step 14).*

To autoscale the backend from 1 to 5 pods when CPU hits 70%:
```bash
kubectl autoscale deployment popquiz-backend --cpu-percent=70 --min=1 --max=5 -n popquiz
```

To autoscale the frontend:
```bash
kubectl autoscale deployment popquiz-frontend --cpu-percent=70 --min=1 --max=5 -n popquiz
```

Monitor your autoscalers:
```bash
kubectl get hpa -n popquiz -w
```

### Scaling Databases (Tier 1)

Stateful databases like **Redis** and **Qdrant** scale differently. They are managed by our Helm chart.

To scale the databases, you do **not** use the `kubectl autoscale` command. Instead, you update the `replicaCount` in your `values.yaml` file:

1. Open `k8s/helm/infrastructure/values.yaml`
2. Change the replicas (e.g., `replicaCount: 5`)
3. Apply the changes gracefully via Helm:
```bash
helm upgrade --install infra k8s/helm/infrastructure -n popquiz
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

# ── AWS / EKS specific ──
aws eks list-clusters --region ap-south-1
aws eks describe-cluster --name popquiz-cluster --region ap-south-1
aws eks update-kubeconfig --name popquiz-cluster --region ap-south-1

# ── eksctl shortcuts ──
eksctl get cluster --region ap-south-1
eksctl get nodegroup --cluster popquiz-cluster --region ap-south-1
eksctl scale nodegroup --cluster popquiz-cluster --name popquiz-nodes --nodes 3 --region ap-south-1
eksctl delete cluster --name popquiz-cluster --region ap-south-1

# ── Monitoring ──
kubectl get pods -n monitoring
kubectl top nodes
kubectl top pods -n popquiz
kubectl port-forward svc/prometheus-grafana -n monitoring 3001:80        # local access
kubectl get svc prometheus-grafana -n monitoring                        # check EXTERNAL-IP
```

---

## Additional Resources

| Resource | Link |
|----------|------|
| EKS Documentation | [docs.aws.amazon.com/eks](https://docs.aws.amazon.com/eks/latest/userguide/getting-started.html) |
| eksctl Documentation | [eksctl.io](https://eksctl.io/) |
| AWS Free Tier | [aws.amazon.com/free](https://aws.amazon.com/free/) |
| EBS CSI Driver | [github.com/kubernetes-sigs/aws-ebs-csi-driver](https://github.com/kubernetes-sigs/aws-ebs-csi-driver) |
| IRSA Documentation | [docs.aws.amazon.com/eks/iam-roles-for-service-accounts](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html) |
| Cluster Autoscaler on AWS | [github.com/kubernetes/autoscaler](https://github.com/kubernetes/autoscaler/blob/master/cluster-autoscaler/cloudprovider/aws/README.md) |
| kube-prometheus-stack (Helm) | [github.com/prometheus-community/helm-charts](https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack) |
| Metrics Server | [github.com/kubernetes-sigs/metrics-server](https://github.com/kubernetes-sigs/metrics-server) |
| kubectl Cheat Sheet | [kubernetes.io/docs/reference/kubectl/cheatsheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/) |
| nip.io Documentation | [nip.io](https://nip.io/) |
| PopQuiz README | [README.md](README.md) |
