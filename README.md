# PopQuiz - AI Powered Quiz Hosting Website

![PopQuiz Banner](https://img.shields.io/badge/PopQuiz-AI%20Quiz%20Hosting-7e22ce?style=for-the-badge&logo=appveyor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

PopQuiz is a full-stack web application that allows users to **instantly generate and host interactive quizzes on any topic using Gemini AI**. It features a modern, real-time interface for both quiz creation and participation, all built on a fast and scalable architecture.

---

## ✨ Key Features

- **🤖 AI-Powered Generation**: Create quizzes automatically by providing a topic, difficulty, and number of questions.
- **🌐 Live Hosting**: Host quizzes and invite participants to join with a unique room code.
- **🚀 Modern Tech Stack**: Built with Next.js, TypeScript, TailwindCSS and GSAP for a beautiful and performant frontend.
- **⚙️ Robust Backend**: Powered by Node.js and Express for a scalable and reliable API.
- **🔐 Secure Authentication**: Uses JSON Web Tokens (JWT) stored in secure cookies.
- **🐳 Dockerized**: Comes with a one-command Docker Compose setup for easy local development.
- **☁️ Cloud-Ready**: Includes Kubernetes manifests with Blue-Green and Canary deployment strategies for zero-downtime deployments.
- **🏗️ Infrastructure as Code**: Terraform configurations for automated GCP infrastructure provisioning and management.
- **📊 Real-time Communication**: WebSocket support with Socket.IO for live quiz interactions and real-time updates.

---

## 🚀 Tech Stack

| Category             | Technology                                                                                                                                                                                                                                                                                                                                        |
| :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Frontend**         | ![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white) ![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white) |
| **Backend**          | ![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white) ![Express](https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white) ![Socket.io](https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socket.io&logoColor=white)                |
| **Database**         | ![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white) ![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)                                                                                                                                       |
| **AI**               | ![Groq](https://img.shields.io/badge/Groq-FF6F00?style=for-the-badge&logo=ai&logoColor=white)                                                                                                                                                                                                                                                     |
| **Containerization** | ![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)                                                                                                                                                                                                                                             |
| **Orchestration**    | ![Kubernetes](https://img.shields.io/badge/Kubernetes-326CE5?style=for-the-badge&logo=kubernetes&logoColor=white) ![Helm](https://img.shields.io/badge/Helm-0F1689?style=for-the-badge&logo=helm&logoColor=white)                                                                                                                                 |
| **Infrastructure**   | ![Terraform](https://img.shields.io/badge/Terraform-7B42BC?style=for-the-badge&logo=terraform&logoColor=white) ![GCP](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white)                                                                                                                     |
| **Package Manager**  | ![pnpm](https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white)                                                                                                                                                                                                                                                   |

---

## 🛠️ Local Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/en/) (v18 or later)
- [pnpm](https://pnpm.io/installation) (`npm install -g pnpm`)
- [Docker](https://www.docker.com/products/docker-desktop/) & Docker Compose

### Clone the Repository

````bash
git clone [https://github.com/your-username/popquiz.git](https://github.com/your-username/popquiz.git)
cd popquiz

---

# 🛠️ Local Development Setup

Follow these steps to get the project running locally:

## Clone the repository

```bash
git clone https://github.com/your-username/popquiz.git
cd popquiz
````

## ⚙️ Backend Setup

### The backend is built with Node.js + Express + TypeScript—a powerful combo! 💪

### Step 1: Navigate to the backend folder

```bash
cd backend
```

### Step 2: Install dependencies We use pnpm for faster installs and better caching. If you don’t have it, install it globally:

```bash
npm install -g pnpm
pnpm install
```

### Step 3: Set up environment variables Copy the example .env file and customize it:

```bash
cp .env.example .env
```

## 🎨 Frontend Setup

### The frontend is a sleek Next.js + TypeScript + TailwindCSS setup—beautiful and blazing fast!

### Step 1: Navigate to the frontend folder

```bash
cd ../frontend
```

### Step 2: Install dependencies

```bash
pnpm install
```

### Step 3: Set up environment variables Copy the example .env file:

```bash
cp .env.example .env
```

### This tells the frontend where to find the backend. Easy peasy! 😎

## 🐳 Run with Docker (Recommended)

### Docker Compose makes it super simple to run the frontend, backend, MongoDB, and Redis together! 🚀

### Step 1: Start all services

```bash
docker compose -f docker-compose/dev.yml up --build -d
```

### This will:

- Spin up MongoDB 🗄️
- Launch Redis for caching 🔴
- Start the Backend ⚙️
- Fire up the Frontend 🌐

### Step 2: Check running containers

```bash
docker ps
```

## ☸️ Kubernetes Deployment

### PopQuiz comes with production-ready Kubernetes manifests supporting multiple deployment strategies!

### Available Deployment Strategies:

#### 1. **Base Deployment** (Simple & Straightforward)

```bash
kubectl apply -f k8s/base/
```

#### 2. **Blue-Green Deployment** (Zero-downtime updates)

```bash
kubectl apply -f k8s/blue-green/
```

#### 3. **Canary Deployment** (Gradual rollout with traffic splitting)

```bash
kubectl apply -f k8s/canary/
```

#### 4. **Helm Chart** (Package manager for Kubernetes)

```bash
helm install popquiz k8s/helm/popquiz-chart/
```

### Features:

- ✅ Horizontal Pod Autoscaling (HPA)
- ✅ Vertical Pod Autoscaling (VPA)
- ✅ WebSocket support via NGINX Ingress
- ✅ Security contexts and resource limits
- ✅ Redis for session management

## 🏗️ Terraform Infrastructure

### Automate your GCP infrastructure provisioning with Terraform!

### Step 1: Navigate to terraform directory

```bash
cd terraform
```

### Step 2: Initialize Terraform

```bash
terraform init
```

### Step 3: Review the plan

```bash
terraform plan
```

### Step 4: Apply infrastructure

```bash
terraform apply
```

### What gets provisioned:

- 🌐 GKE (Google Kubernetes Engine) cluster
- 🔒 VPC networks and firewall rules
- 💾 Persistent storage resources
- 🔑 Service accounts and IAM roles
- 📊 Monitoring and logging setup

## 💻 Running Without Docker (Optional)

### Prefer running things manually? No problem! 😊

#### Backend:

```bash
cd backend
pnpm dev
```

#### Frontend:

```bash
cd frontend
pnpm dev
```

- ### Visit http://localhost:3000 for the frontend 🎉

- ### Backend runs at http://localhost:5000 ⚙️

# 🤝 Contributing to PopQuiz 🌟

## We love new contributors! Whether you're fixing bugs, adding features, or improving docs, here’s how to jump in:

### Step 1: Create a new branch

```bash
git checkout -b feature/my-new-feature
```

### Step 2: Commit your changes

```bash
git add .
git commit -m "Added my awesome new feature 🚀"
```

### Step 3: Push and open a Pull Request

```bash
git push origin feature/my-new-feature
```

### Then head to GitHub and create a Pull Request. We’ll review it with a smile! 😄

# 🔑 API Key Notes ⚠️

- #### A Groq API Key is required for quiz generation. Keep it safe! 🔒

- #### Never share your .env file publicly.

- #### If your key is leaked, revoke it immediately from the Groq Console.

# 💡 Why Contribute to PopQuiz?

- #### Learn: Dive into a modern full-stack app with Next.js, TypeScript, AI integration, Kubernetes orchestration, and Infrastructure as Code.

- #### Impact: Help create a fun, educational tool for students and teachers worldwide.

- #### Community: Join a friendly team of developers passionate about learning and tech! 🤗

- #### Cloud-Native: Gain hands-on experience with Docker, Kubernetes, Terraform, and cloud deployment strategies.

# 📚 Project Structure

```
PopQuiz/
├── frontend/          # Next.js frontend application
├── backend/           # Node.js + Express backend
├── k8s/              # Kubernetes manifests
│   ├── base/         # Basic deployment
│   ├── blue-green/   # Blue-green deployment strategy
│   ├── canary/       # Canary deployment strategy
│   ├── helm/         # Helm charts
│   └── autoscaling/  # HPA & VPA configurations
├── terraform/        # Infrastructure as Code
├── docker-compose/   # Docker Compose files
└── ansible/          # Configuration management (optional)
```

# 🌐 Deployment Strategies Explained

### **Blue-Green Deployment**

Two identical production environments (Blue & Green). Traffic switches instantly from one to the other, enabling instant rollback if issues arise.

### **Canary Deployment**

New version is gradually rolled out to a small percentage of users first (e.g., 10%), then gradually increased. Reduces risk of widespread issues.

### **Horizontal Pod Autoscaling (HPA)**

Automatically scales the number of pods based on CPU/memory usage or custom metrics.

### **Vertical Pod Autoscaling (VPA)**

Automatically adjusts CPU and memory requests/limits based on actual usage patterns.

- #### Happy coding, and let's make PopQuiz even more awesome together! 🚀✨
