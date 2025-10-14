# Kubernetes Deployment Strategies Showcase

![Kubernetes Logo](https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)

Welcome! This repository serves as a practical guide and a collection of manifests for demonstrating various application deployment strategies on Kubernetes. Whether you're a beginner or an experienced developer, you can use these examples to understand and implement robust deployment patterns.

---

## ✨ Features

This project provides hands-on examples for the following deployment strategies:

- **Base Deployment**: A standard, straightforward deployment.
- **Autoscaling**: Automatically scale your application based on resource utilization.
- **Blue-Green Deployment**: Achieve zero-downtime releases by switching traffic between two identical environments.
- **Canary Deployment**: Gradually roll out new versions to a small subset of users to minimize risk.
- **Monitoring**: Set up a complete monitoring stack using Prometheus and Grafana.

---

## 📋 Prerequisites

Before you begin, ensure you have the following tools installed and configured:

- **kubectl**: The Kubernetes command-line tool.
- **A Kubernetes Cluster**: A running cluster, such as [Minikube](https://minikube.sigs.k8s.io/docs/start/), [Docker Desktop](https://www.docker.com/products/docker-desktop/), or a cloud-based cluster (GKE, EKS, AKS).
- **An Ingress Controller**: Required for Blue-Green and Canary strategies. If you don't have one, we recommend the [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/deploy/).
- **Git**: For cloning the repository.
- **Helm**: The package manager for Kubernetes, used to install the monitoring stack.

---

## 🚀 Getting Started

Follow these initial setup steps before trying any of the deployment strategies.

1.  **Clone the Repository**

    ```bash
    git clone [https://github.com/your-username/popquiz.git](https://github.com/your-username/popquiz.git)
    cd my-k8s-project
    ```

2.  **Create the Namespace**
    All resources will be deployed in a dedicated `popquiz` namespace to keep them isolated.

    ```bash
    kubectl create namespace popquiz
    ```

3.  **Create Application Configuration**
    Create the necessary Kubernetes Secrets and ConfigMaps from your local `.env` files.

    ```bash
    # Create secrets for the backend (e.g., database credentials)
    kubectl create secret generic backend-secrets --namespace popquiz --from-env-file=.env.backend

    # Create a configmap for the frontend (e.g., API URLs)
    kubectl create configmap frontend-config --namespace popquiz --from-env-file=.env.frontend
    ```

---

## deployment Deployment Strategies

Choose a strategy below and follow the instructions.

### Base Deployment

This is the most basic way to run the application with a single Deployment and Service.

1.  **Navigate to the directory:**
    ```bash
    cd base
    ```
2.  **Apply the manifests:**
    ```bash
    kubectl apply -f deployment.yaml
    kubectl apply -f service.yaml
    ```
3.  **Verify the deployment:**
    ```bash
    kubectl get deployment,service -n popquiz
    ```

### Autoscaling Deployment

This setup automatically scales the number of pods based on CPU load.

1.  **Deploy the Base Application First:**
    ```bash
    kubectl apply -f base/deployment.yaml
    kubectl apply -f base/service.yaml
    ```
2.  **Apply the Horizontal Pod Autoscaler (HPA):**
    ```bash
    kubectl apply -f autoscaling/hpa.yaml
    ```
3.  **Verify the HPA:**
    ```bash
    kubectl get hpa -n popquiz
    ```
    To see it in action, you can generate load on the service and watch the pod count increase with `kubectl get pods -n popquiz -w`. See the "Useful Commands" section for a load generator script.

### Blue-Green Deployment 🔵🟢

Deploy a new version alongside the old one and switch traffic instantly with zero downtime.

1.  **Deploy the Blue Environment:**
    Apply the blue deployment, its service, and the Ingress that points to it.
    ```bash
    kubectl apply -f blue-green/deployment-blue.yaml
    kubectl apply -f blue-green/service.yaml
    kubectl apply -f blue-green/ingress.yaml
    ```
2.  **Verify Blue is Live 🔵:**
    Check that the Ingress is routing traffic to the blue services.

    ```bash
    # Check the frontend route
    kubectl get ingress popquiz-ingress -n popquiz -o jsonpath='{.spec.rules[0].http.paths[0].backend.service.name}'
    # Check the backend route
    kubectl get ingress popquiz-ingress -n popquiz -o jsonpath='{.spec.rules[0].http.paths[1].backend.service.name}'
    ```

    _Expected Output:_ `popquiz-frontend-service-blue` and `popquiz-backend-service-blue`.

3.  **Deploy the Green Environment:**
    Deploy the new version. This step does not affect live traffic.
    ```bash
    kubectl apply -f blue-green/deployment-green.yaml
    ```
4.  **The Switch! Redirect Traffic to Green 🟢:**
    Patch the Ingress to atomically switch traffic to the green services.
    ```bash
    kubectl patch ingress popquiz-ingress -n popquiz --type='json' -p='[
      {"op": "replace", "path": "/spec/rules[0]/http/paths/0/backend/service/name", "value":"popquiz-frontend-service-green"},
      {"op": "replace", "path": "/spec/rules[0]/http/paths/1/backend/service/name", "value":"popquiz-backend-service-green"}
    ]'
    ```
5.  **Verify Green is Live ✅:**
    Run the same verification commands from step 2. The output should now point to the green services.
    _Expected Output:_ `popquiz-frontend-service-green` and `popquiz-backend-service-green`.

### Canary Deployment 🐦

Gradually shift a percentage of traffic to a new version to test it in production before a full rollout.

1.  **Deploy the Primary (Stable) Version:**
    ```bash
    kubectl apply -f canary/deployment-primary.yaml
    kubectl apply -f canary/service.yaml
    ```
2.  **Expose the Primary Version:**
    Apply the main Ingress that sends 100% of traffic to the primary version.
    ```bash
    kubectl apply -f canary/ingress.yaml
    ```
3.  **Deploy the Canary Version:**
    Deploy the new version of your application. It won't receive any traffic yet.
    ```bash
    kubectl apply -f canary/deployment-canary.yaml
    ```
4.  **Begin the Canary Rollout (10% Traffic):**
    Apply the traffic split configuration. This example assumes you are using a service mesh or an Ingress controller that supports weighted routing (e.g., NGINX with a canary ingress).
    ```bash
    # This file contains the rules to send 10% of traffic to the canary
    kubectl apply -f canary/traffic-split.yaml
    ```
5.  **Monitor the Canary** and gradually increase the traffic percentage by modifying `traffic-split.yaml` until it reaches 100%.

---

## 📊 Monitoring with Prometheus and Grafana

Set up a robust monitoring stack to visualize metrics from your cluster and applications. We'll use the `kube-prometheus-stack` Helm chart, which provides a comprehensive, pre-configured setup.

1.  **Add the Prometheus Community Helm repository:**
    This command adds the repository that contains the chart we need.

    ```bash
    helm repo add prometheus-community [https://prometheus-community.github.io/helm-charts](https://prometheus-community.github.io/helm-charts)
    helm repo update
    ```

2.  **Create a Monitoring Namespace:**
    It's best practice to install monitoring tools in their own dedicated namespace.

    ```bash
    kubectl create namespace monitoring
    ```

3.  **Install the kube-prometheus-stack:**
    This Helm command deploys Prometheus, Grafana, Alertmanager, and various exporters to collect metrics from your cluster's nodes and services.

    ```bash
    helm install prometheus prometheus-community/kube-prometheus-stack --namespace monitoring
    ```

4.  **Verify the Installation:**
    Check that all the pods for the monitoring stack are running correctly. You should see pods for Prometheus, Grafana, node-exporter, and others.

    ```bash
    kubectl get pods -n monitoring
    ```

5.  **Access the Grafana Dashboard:**
    Use `port-forward` to access the Grafana UI from your local machine.
    ```bash
    kubectl port-forward svc/prometheus-grafana -n monitoring 3000:80
    ```
    - Open your browser and go to `http://localhost:3000`.
    - The default username is `admin`.
    - To get the default password, run this command:
      ```bash
      kubectl get secret --namespace monitoring prometheus-grafana -o jsonpath="{.data.admin-password}" | base64 --decode
      ```
    - Once logged in, you can explore the pre-built dashboards for Kubernetes monitoring!

---

## 🛠️ Useful `kubectl` Commands

Here are some helpful commands for debugging and managing your deployments.

### General Management & Debugging

| Command                                                   | Description                                               |
| --------------------------------------------------------- | --------------------------------------------------------- |
| `kubectl get pods -n popquiz -w`                          | Watch pods being created or terminated in real-time.      |
| `kubectl describe pod <pod-name> -n popquiz`              | Get detailed information and events for a specific pod.   |
| `kubectl logs <pod-name> -n popquiz`                      | View the logs from a specific pod.                        |
| `kubectl logs -f <pod-name> -n popquiz`                   | Stream the logs from a pod in real-time.                  |
| `kubectl rollout status deployment <name> -n popquiz`     | Check the status of a deployment rollout.                 |
| `kubectl rollout restart deployment <name> -n popquiz`    | Trigger a rolling restart of all pods in a deployment.    |
| `kubectl scale deployment <name> --replicas=3 -n popquiz` | Manually scale a deployment to a specific number of pods. |

### Testing the Application from Inside the Cluster

To test the API communication between the frontend and backend pods directly.

1.  **Find a frontend pod name:**
    ```bash
    kubectl get pods -n popquiz
    ```
2.  **Exec into the frontend pod:** (Replace `<pod-hash>` with the unique ID from the previous command)
    ```bash
    kubectl exec -it -n popquiz popquiz-frontend-deployment-<pod-hash> -- sh
    ```
3.  **Inside the pod's shell, install `curl` and test the backend:**

    ```bash
    # Install curl utility
    apk add curl

    # Generate a new quiz
    curl -X POST \
      -H "Content-Type: application/json" \
      -d '{"topic": "Hyper Cars", "difficulty": "medium", "count": 1}' \
      http://popquiz-backend-service/api/quiz/generate

    # Fetch a quiz by its room name
    curl http://popquiz-backend-service/api/quiz/your-room-name-here
    ```

### Generating Load for HPA Testing

To test the Horizontal Pod Autoscaler, you need to generate CPU load.

1.  **Open two terminals.**

    - In the first terminal, watch the HPA status: `kubectl get hpa -n popquiz -w`
    - In the second terminal, watch the pods: `kubectl get pods -n popquiz -w`

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
    ```bash
    apk add curl
    # This loop continuously sends requests to the frontend service, generating load.
    while true; do curl -s http://popquiz-frontend-service > /dev/null; done
    ```
5.  **Observe the terminals from Step 1.** You will see the CPU utilization climb in the HPA status, and after it crosses the target threshold, Kubernetes will start creating new pods.

---

## 🤝 Contributing

Contributions are welcome! If you have suggestions for improvements, new strategies, or find any issues, please feel free to open an issue or submit a pull request.

---

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.
