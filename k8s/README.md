# Kubernetes Deployment Strategies Showcase

![Kubernetes Logo](https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)

Welcome! This repository serves as a practical guide and a collection of manifests for demonstrating various application deployment strategies on Kubernetes. Whether you're a beginner or an experienced developer, you can use these examples to understand and implement robust deployment patterns.

---

## 🏗️ Architecture Overview

PopQuiz is a 5-service application. Understanding what each service does will help you follow the rest of this guide.

```text
 ┌─────────────────────────────────────────────────────────────┐
 │                 TIER 2: APPLICATION LAYER                   │
 │        (Deployed via Base, Blue-Green, or Canary)           │
 │                                                             │
 │   ┌──────────────┐       ┌──────────────┐                   │
 │   │   Frontend   │──────▶│   Backend    │                   │
 │   │  (Next.js)   │       │ (Express.js) │                   │
 │   │  Port: 3000  │       │  Port: 5000  │                   │
 │   └──────────────┘       └──────┬───────┘                   │
 │                                 │                           │
 │                                 ▼                           │
 │                          ┌──────────────┐                   │
 │                          │  Langchain   │                   │
 │                          │  (FastAPI)   │                   │
 │                          │  Port: 8000  │                   │
 │                          └──────────────┘                   │
 └─────────────────────────────────┬───────────────────────────┘
                                   │
                                   ▼
 ┌─────────────────────────────────────────────────────────────┐
 │                TIER 1: INFRASTRUCTURE LAYER                 │
 │                    (Deployed via Helm)                      │
 │                                                             │
 │   ┌──────────────┐                              ┌───────────┐
 │   │    Redis     │                              │  Qdrant   │
 │   │   (Cache)    │                              │(Vector DB)│
 │   │  Port: 6379  │                              │Port: 6333 │
 │   └──────────────┘                              └───────────┘
 │           ▲                                           ▲     │
 │           │                                           │     │
 │    (Backend connects)                     (Langchain connects)
 └─────────────────────────────────────────────────────────────┘
```

| Service | What It Does | Exposed? |
|---------|-------------|----------|
| **Frontend** | Next.js app — the user interface | Yes (via Ingress) |
| **Backend** | Express.js API — handles auth, quizzes, WebSockets | Yes (via Ingress at `/api` and `/socket.io`) |
| **Langchain** | FastAPI AI service — generates quizzes using Gemini + RAG | No (internal only, backend calls it) |
| **Qdrant** | Vector database — stores document embeddings for RAG | No (internal only, langchain calls it) |
| **Redis** | In-memory cache — stores game room state | No (internal only, backend calls it) |

---

## ✨ Features

This project provides hands-on examples for the following deployment strategies:

- **Base Deployment**: A standard, straightforward deployment of all 5 services.
- **Autoscaling**: Automatically scale your stateless apps using HPA and your databases using Helm values.
- **Zero-Downtime Updates**: Restart your pods without downtime using simple rolling updates.
- **Blue-Green Deployment**: Achieve zero-downtime releases by switching traffic between two identical environments.
- **Canary Deployment**: Gradually roll out new versions to a small subset of users to minimize risk.
- **Helm Chart**: Package and deploy the entire stack with a single command using Helm.
- **Monitoring**: Set up a complete monitoring stack using Prometheus and Grafana.

---

## 📋 Prerequisites

Before you begin, ensure you have the following tools installed and configured:

- **kubectl**: The Kubernetes command-line tool. ([Install Guide](https://kubernetes.io/docs/tasks/tools/))
- **A Kubernetes Cluster**: A running cluster. See the setup guides for your environment:
  - **Local:** [Kind](KIND.md) (lightweight, Docker-based) · [Minikube](MINIKUBE.md) (feature-rich, built-in addons)
  - **Cloud:** [GKE](GKE.md) (Google Kubernetes Engine) · [EKS](EKS.md) (Amazon EKS) · AKS
- **An Ingress Controller**: Required for routing external traffic. We recommend the [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/deploy/).
- **Git**: For cloning the repository.
- **Helm** _(optional)_: The package manager for Kubernetes — only needed for the Helm deployment and monitoring stack.

> **💡 New to Kubernetes?** Set up a local cluster first with [Kind](KIND.md) or [Minikube](MINIKUBE.md), then start with the [Base Deployment](#base-deployment) strategy. It's the simplest and will help you understand how the pieces fit together before moving to advanced strategies.

---

## 🚀 Getting Started

Follow these steps **once** before trying any deployment strategy. They set up the namespace, ingress controller, and secrets that every strategy needs.

### Step 1 — Clone the Repository

```bash
git clone https://github.com/AbhayTopno/popquiz.git
cd Popquiz/k8s
```

### Step 2 — Create the Namespace

All resources live in a dedicated `popquiz` namespace to keep them isolated from other workloads.

```bash
kubectl create namespace popquiz
```

> **What is a namespace?** Think of it like a folder — it groups related resources together and prevents naming conflicts.

### Step 3 — Deploy the Ingress Controller

The Ingress Controller is a special Kubernetes component that listens for Ingress resources and routes external HTTP traffic to your services.

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
```

Wait for it to be ready (this can take 1-2 minutes):

```bash
kubectl get pods -n ingress-nginx -w
# Wait until STATUS shows "Running" for the controller pod, then press Ctrl+C
```

### Step 4 — Create Your Environment Files

Copy the example files and fill in your actual values:

```bash
cp .env.example.backend .env.backend
cp .env.example.frontend .env.frontend
cp .env.example.langchain .env.langchain
```

Now edit each file with your real credentials:

| File | Key Variables to Set |
|------|---------------------|
| `.env.backend` | `MONGO_URI`, `JWT_SECRET`, `GROQ_API_KEY`, `CORS_ORIGIN`, `COOKIE_DOMAIN` |
| `.env.frontend` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL` (set to your cluster IP) |
| `.env.langchain` | `GOOGLE_API_KEY` (your Gemini API key) |

> **⚠️ Security:** Never commit `.env.backend`, `.env.frontend`, or `.env.langchain` to Git. They are already in `.gitignore`.

### Step 5 — Create Kubernetes Secrets and ConfigMaps

Kubernetes stores sensitive data in **Secrets** (encrypted) and non-sensitive config in **ConfigMaps**.

```bash
# Backend secrets (database credentials, API keys, etc.)
kubectl create secret generic backend-secrets \
  --from-env-file=.env.backend \
  --namespace=popquiz

# Frontend config (public URLs — not sensitive)
kubectl create configmap frontend-secrets \
  --from-env-file=.env.frontend \
  --namespace=popquiz

# Langchain secrets (Gemini API key, Qdrant config)
kubectl create secret generic langchain-secrets \
  --from-env-file=.env.langchain \
  --namespace=popquiz
```

**Verify they were created:**

```bash
kubectl get secrets,configmaps -n popquiz
```

You should see `backend-secrets`, `frontend-secrets`, and `langchain-secrets` in the output.

### Step 6 — Set Your Cluster IP

The ingress manifests use `YOUR_CLUSTER_IP.nip.io` as a placeholder. Before applying any ingress file, replace it with your actual cluster IP:

```bash
# Find your cluster IP
minikube ip          # For Minikube
kubectl get nodes -o wide  # For cloud clusters — use the EXTERNAL-IP
```

Then do a find-and-replace in the ingress files:

```bash
# Linux / macOS
sed -i 's/YOUR_CLUSTER_IP/192.168.58.2/g' base/ingress.yml
sed -i 's/YOUR_CLUSTER_IP/192.168.58.2/g' blue-green/ingress.yml
sed -i 's/YOUR_CLUSTER_IP/192.168.58.2/g' canary/ingress-stable.yml
sed -i 's/YOUR_CLUSTER_IP/192.168.58.2/g' canary/ingress-canary.yml
```

Also update your `.env.backend` and `.env.frontend` files with the same IP for `CORS_ORIGIN`, `COOKIE_DOMAIN`, `NEXT_PUBLIC_API_URL`, etc.

> **💡 Tip:** On Windows, use your IDE's find-and-replace across files, or PowerShell:
> ```powershell
> Get-ChildItem -Recurse -Filter *.yml | ForEach-Object {
>   (Get-Content $_.FullName) -replace 'YOUR_CLUSTER_IP','192.168.58.2' | Set-Content $_.FullName
> }
> ```

### Step 7 — Deploy the Database Infrastructure (Tier 1 - Required!)

Before deploying your applications, you must deploy the foundational databases (Redis and Qdrant). We use Helm for this because setting up highly available clustered databases requires it.

```bash
# 1. Download the database charts
helm dependency update k8s/helm/infrastructure

# 2. Deploy the databases
helm upgrade --install infra k8s/helm/infrastructure -n popquiz
```
Wait a moment for the database pods to start up. These databases will remain running in the background while you experiment with the application deployment strategies below.

---

## Deployment Strategies

Choose **one** strategy below and follow its instructions to deploy your applications. Each strategy deploys the same 3 stateless services (Frontend, Backend, Langchain) and connects to the databases you deployed in Step 7.

> **🔰 Recommended for beginners:** Start with [Base Deployment](#base-deployment), then try [Autoscaling](#autoscaling-deployment).

---

### Base Deployment

The simplest strategy — one replica of each service with a straightforward rollout.

**What you'll deploy:**

```
deployment.yml  →  Langchain + Backend + Frontend
service.yml     →  Internal networking for the 3 app services
ingress.yml     →  External access (routes /api → backend, / → frontend)
```

**Steps:**

1.  **Apply all manifests:**
    ```bash
    kubectl apply -f base/deployment.yml
    kubectl apply -f base/service.yml
    kubectl apply -f base/ingress.yml
    ```

2.  **Verify everything is running:**
    ```bash
    kubectl get pods -n popquiz
    ```

    You should see 5 pods (one per service), all with `STATUS: Running`:

    ```
    NAME                                          READY   STATUS    AGE
    popquiz-langchain-xxxxx                       1/1     Running   30s
    popquiz-backend-xxxxx                         1/1     Running   30s
    popquiz-frontend-xxxxx                        1/1     Running   30s
    ```

    > **💡 Tip:** If a pod shows `Pending` or `CrashLoopBackOff`, check what went wrong:
    > ```bash
    > kubectl describe pod <pod-name> -n popquiz
    > kubectl logs <pod-name> -n popquiz
    > ```

3.  **Check services and ingress:**
    ```bash
    kubectl get svc -n popquiz
    kubectl get ingress -n popquiz
    ```

---

### Autoscaling Deployment 📈

Automatically scales your stateless apps (Frontend, Backend, Langchain) out (more pods) when CPU usage increases, and scales your databases (Redis, Qdrant) via Helm config.

> **How it works:** For stateless apps, the Horizontal Pod Autoscaler (HPA) watches CPU metrics via the Metrics Server. When average CPU exceeds the target, it adds pods. When load drops, it removes them.

**Steps for Stateless Apps (Tier 2):**

1.  **Deploy the base application first** (if not already running):
    ```bash
    kubectl apply -f base/deployment.yml
    kubectl apply -f base/service.yml
    kubectl apply -f base/ingress.yml
    ```

2.  **Autoscale the Frontend and Backend using the CLI:**
    ```bash
    kubectl autoscale deployment popquiz-backend --cpu-percent=70 --min=1 --max=5 -n popquiz
    kubectl autoscale deployment popquiz-frontend --cpu-percent=70 --min=1 --max=5 -n popquiz
    ```

3.  **Verify the HPAs:**
    ```bash
    kubectl get hpa -n popquiz
    ```

    Expected output:
    ```
    NAME                     REFERENCE                               TARGETS   MINPODS   MAXPODS
    popquiz-frontend         Deployment/popquiz-frontend             10%/70%   1         5
    popquiz-backend          Deployment/popquiz-backend              15%/70%   1         5
    ```

    > **📝 Note:** The `TARGETS` column shows `<current>/<target>`. If it shows `<unknown>/70%`, the Metrics Server may not be installed yet. See the [Monitoring](#-monitoring-with-prometheus-and-grafana) section.

**Steps for Databases (Tier 1):**

For stateful databases like Redis and Qdrant managed by Helm, scaling is done by updating the cluster size, not via CPU metrics.
1. Update `replicaCount` in `k8s/helm/infrastructure/values.yaml`
2. Run `helm upgrade --install infra k8s/helm/infrastructure -n popquiz`

---

### Zero-Downtime Updates 🔄

When you update your application code and push a new Docker image with the **same tag** (e.g., `latest`), Kubernetes won't automatically pull it because the deployment YAML hasn't changed.

To force Kubernetes to pull the new image with **zero downtime**, simply restart the deployment. Kubernetes will gracefully start new pods, wait for them to become healthy, and only then terminate the old pods.

```bash
# Restart Backend
kubectl rollout restart deployment popquiz-backend -n popquiz

# Restart Frontend
kubectl rollout restart deployment popquiz-frontend -n popquiz
```

---

### Helm Chart Deployment 🚢

Package and deploy the 3 application services with a single Helm command. Helm makes it easy to version, upgrade, and rollback your stateless applications.

1.  **Navigate to the Helm directory:**
    ```bash
    cd helm
    ```

2.  **Review the default values** _(optional but recommended)_:
    ```bash
    cat popquiz-chart/values.yaml
    ```

    You can override any value at install time with `--set key=value`.

3.  **Create Secrets first** (Helm does not manage secrets — they must exist before install):
    ```bash
    kubectl create secret generic backend-secrets \
      --from-env-file=../.env.backend --namespace=popquiz
    kubectl create secret generic langchain-secrets \
      --from-env-file=../.env.langchain --namespace=popquiz
    kubectl create configmap frontend-secrets \
      --from-env-file=../.env.frontend --namespace=popquiz
    ```

4.  **Install the chart:**
    ```bash
    helm install popquiz-release ./popquiz-chart \
      --namespace popquiz \
      --create-namespace
    ```

5.  **Verify the release:**
    ```bash
    helm list -n popquiz
    kubectl get pods -n popquiz
    ```

6.  **Upgrade after making changes:**
    ```bash
    helm upgrade popquiz-release ./popquiz-chart --namespace popquiz
    ```

7.  **Rollback if something goes wrong:**
    ```bash
    helm rollback popquiz-release 1 --namespace popquiz
    ```

---

### Blue-Green Deployment 🔵🟢

Deploy a new version alongside the old one and switch traffic instantly with zero downtime.

**How it works:** You run two identical environments ("blue" and "green"). Only one receives live traffic at a time. You deploy updates to the idle environment, verify it works, then switch the Ingress to point to it.

```
                    ┌─────────────────┐
  Traffic ────────▶ │    Ingress      │
                    └──────┬──────────┘
                           │
              ┌────────────┼────────────┐
              ▼ (active)                ▼ (idle)
        ┌──────────┐             ┌──────────┐
        │   Blue   │             │  Green   │
        │ (v12)    │             │ (v13)    │
        └──────────┘             └──────────┘
```

**Steps:**

1.  **Deploy the Blue environment** (this becomes the live version):
    ```bash
    kubectl apply -f blue-green/deployment-blue.yml
    kubectl apply -f blue-green/service.yml
    kubectl apply -f blue-green/ingress.yml   # Make sure you replaced YOUR_CLUSTER_IP first
    ```

2.  **Verify Blue is live** 🔵:
    ```bash
    kubectl get ingress popquiz-ingress -n popquiz \
      -o jsonpath='{.spec.rules[0].http.paths[0].backend.service.name}'
    ```
    _Expected:_ `popquiz-backend-blue`

3.  **Deploy the Green environment** (idle — no traffic hits it yet):
    ```bash
    kubectl apply -f blue-green/deployment-green.yml
    ```

4.  **Verify Green pods are healthy before switching:**
    ```bash
    kubectl get pods -n popquiz -l version=green
    # All should show Running and Ready
    ```

5.  **Switch traffic to Green** 🟢:
    ```bash
    kubectl patch ingress popquiz-ingress -n popquiz --type='json' -p='[
      {"op": "replace", "path": "/spec/rules/0/http/paths/0/backend/service/name", "value": "popquiz-backend-green"},
      {"op": "replace", "path": "/spec/rules/0/http/paths/1/backend/service/name", "value": "popquiz-backend-green"},
      {"op": "replace", "path": "/spec/rules/0/http/paths/2/backend/service/name", "value": "popquiz-frontend-green"}
    ]'
    ```

6.  **Verify Green is live** ✅:
    ```bash
    kubectl get ingress popquiz-ingress -n popquiz \
      -o jsonpath='{.spec.rules[0].http.paths[0].backend.service.name}'
    ```
    _Expected:_ `popquiz-backend-green`

7.  **Rollback** (if something is wrong, switch back to Blue):
    ```bash
    kubectl patch ingress popquiz-ingress -n popquiz --type='json' -p='[
      {"op": "replace", "path": "/spec/rules/0/http/paths/0/backend/service/name", "value": "popquiz-backend-blue"},
      {"op": "replace", "path": "/spec/rules/0/http/paths/1/backend/service/name", "value": "popquiz-backend-blue"},
      {"op": "replace", "path": "/spec/rules/0/http/paths/2/backend/service/name", "value": "popquiz-frontend-blue"}
    ]'
    ```

---

### Canary Deployment 🐦

Gradually shift a percentage of traffic to a new version to test it in production before a full rollout.

**How it works:** The NGINX Ingress Controller supports a `canary-weight` annotation. Two Ingress resources coexist — the stable one gets most traffic, the canary one gets a configurable percentage.

```
  100 requests ──▶  Ingress
                      ├── 90 requests → Stable (v12)
                      └── 10 requests → Canary (v13)
```

**Steps:**

1.  **Deploy the stable version:**
    ```bash
    kubectl apply -f canary/deployment-stable.yml
    kubectl apply -f canary/service.yml
    kubectl apply -f canary/ingress-stable.yml   # Make sure you replaced YOUR_CLUSTER_IP first
    ```

2.  **Deploy the canary version** (doesn't receive traffic yet):
    ```bash
    kubectl apply -f canary/deployment-canary.yml
    ```

3.  **Begin the canary rollout** (starts at 10% traffic):
    ```bash
    kubectl apply -f canary/ingress-canary.yml   # Make sure you replaced YOUR_CLUSTER_IP first
    ```

4.  **Monitor for errors** in the canary pods:
    ```bash
    kubectl logs -f deployment/popquiz-backend-canary -n popquiz
    kubectl logs -f deployment/popquiz-langchain-canary -n popquiz
    ```

5.  **Increase traffic gradually** — edit `canary/ingress-canary.yml` and change the weight:
    ```yaml
    nginx.ingress.kubernetes.io/canary-weight: '25'  # 25%, then 50%, then 100%
    ```
    ```bash
    kubectl apply -f canary/ingress-canary.yml
    ```

6.  **Full promotion** — once confident, set weight to `100` or replace the stable deployment with the canary version and remove the canary Ingress.

---

## 📊 Monitoring with Prometheus and Grafana

To view CPU, memory, pod counts, restarts, and crash states for PopQuiz in Grafana, use the Kubernetes-native monitoring stack only.

### Step 1 — Install Prometheus + Grafana

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

kubectl create namespace monitoring

helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring
```

### Step 2 — Install Metrics Server

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

### Step 3 — Verify the monitoring stack

```bash
kubectl get pods -n monitoring
kubectl get pods -n kube-system | grep metrics-server
```

Wait until the monitoring pods and Metrics Server show `Running`.

### Step 4 — Open Grafana

```bash
kubectl port-forward svc/prometheus-grafana -n monitoring 3001:80
```

Then open:

```text
http://localhost:3001
```

Login with:

- Username: `admin`
- Password:

```bash
kubectl get secret --namespace monitoring prometheus-grafana \
  -o jsonpath="{.data.admin-password}" | base64 --decode
```

### Step 5 — Add panels in Grafana

In Grafana, create panels and use the Prometheus data source with the following queries.

#### CPU usage for all PopQuiz pods

```promql
sum by (pod) (rate(container_cpu_usage_seconds_total{namespace="popquiz"}[5m]))
```

#### Memory usage for all PopQuiz pods

```promql
sum by (pod) (container_memory_working_set_bytes{namespace="popquiz"})
```

#### CPU usage for Redis and Qdrant only

```promql
sum by (pod) (rate(container_cpu_usage_seconds_total{namespace="popquiz", pod=~".*(redis|qdrant).*"}[5m]))
```

#### Memory usage for Redis and Qdrant only

```promql
sum by (pod) (container_memory_working_set_bytes{namespace="popquiz", pod=~".*(redis|qdrant).*"})
```

#### Number of running pods

```promql
sum by (namespace) (kube_pod_status_phase{namespace="popquiz", phase="Running"})
```

#### Number of crashed pods / crash loops

```promql
sum by (namespace) (kube_pod_container_status_waiting_reason{namespace="popquiz", reason="CrashLoopBackOff"})
```

#### Pod restart count

```promql
sum by (pod) (kube_pod_container_status_restarts_total{namespace="popquiz"})
```

#### Deployment replica count

```promql
kube_deployment_status_replicas_available{namespace="popquiz"}
```

These queries are enough to show the CPU, memory, pod count, restart, and crash-state metrics you asked for in Grafana.

---

## 🛠️ Useful `kubectl` Commands

### Viewing All Resources

```bash
# See everything in the popquiz namespace at a glance
kubectl get all -n popquiz
```

### Pod Management & Debugging

| Command | Description |
|---------|-------------|
| `kubectl get pods -n popquiz` | List all pods and their status |
| `kubectl get pods -n popquiz -w` | Watch pods in real-time (Ctrl+C to stop) |
| `kubectl describe pod <pod-name> -n popquiz` | Detailed info + events for a pod |
| `kubectl logs <pod-name> -n popquiz` | View logs from a pod |
| `kubectl logs -f <pod-name> -n popquiz` | Stream logs in real-time |
| `kubectl exec -it <pod-name> -n popquiz -- sh` | Open a shell inside a pod |

### Deployment Operations

| Command | Description |
|---------|-------------|
| `kubectl rollout status deployment <name> -n popquiz` | Check if a rollout completed |
| `kubectl rollout restart deployment <name> -n popquiz` | Restart all pods in a deployment |
| `kubectl rollout undo deployment <name> -n popquiz` | Rollback to previous version |
| `kubectl scale deployment <name> --replicas=3 -n popquiz` | Manually scale a deployment |

### Testing the Application from Inside the Cluster

To test the API communication between the frontend and backend pods directly.

1.  **Find a frontend pod name:**
    ```bash
    kubectl get pods -n popquiz
    ```

2.  **Exec into the frontend pod** (replace `<pod-hash>` with the unique ID from the previous command):
    ```bash
    kubectl exec -it -n popquiz popquiz-frontend-<pod-hash> -- sh
    ```

3.  **Inside the pod's shell, test the backend** (uses `wget` — already built into Alpine, no install needed):
    ```sh
    # Generate a new quiz
    wget -qO- --post-data='{"topic": "Hyper Cars", "difficulty": "medium", "count": 1}' \
      --header='Content-Type: application/json' \
      http://popquiz-backend/api/quiz/generate

    # Fetch a quiz by its room name
    wget -qO- http://popquiz-backend/api/quiz/<quizId>
    ```

### Generating Load for HPA Testing

To test the Horizontal Pod Autoscaler, you need to generate CPU load.

1.  **Open two terminals.**
    - In the first terminal, watch the HPA status:
      ```bash
      kubectl get hpa -n popquiz -w
      ```
    - In the second terminal, watch the pods:
      ```bash
      kubectl get pods -n popquiz -w
      ```

2.  **Find a backend pod name:**
    ```bash
    kubectl get pods -n popquiz
    ```

3.  **Exec into a backend pod and start the load generator script:**
    ```bash
    # Replace <your-backend-pod-name> with a full pod name from the command above
    kubectl exec -it -n popquiz <your-backend-pod-name> -- sh
    ```

4.  **Inside the pod's shell, run this infinite loop:**
    ```sh
    # This loop continuously sends requests to the frontend service, generating load.
    # Uses wget (built into Alpine — no install needed)
    while true; do wget -qO- http://popquiz-frontend > /dev/null 2>&1; done
    ```

Observe the terminals from Step 1. You will see the CPU utilization climb in the HPA status, and after it crosses the target threshold, Kubernetes will start creating new pods.

## 🤝 Contributing

Contributions are welcome! If you have suggestions for improvements, new strategies, or find any issues, please feel free to open an issue or submit a pull request.

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.
