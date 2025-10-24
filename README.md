# PopQuiz - AI Powered Quiz Hosting Website

![PopQuiz Banner](https://img.shields.io/badge/PopQuiz-AI%20Quiz%20Hosting-7e22ce?style=for-the-badge&logo=appveyor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)

PopQuiz is a full-stack web application that allows users to **instantly generate and host interactive quizzes on any topic using Gemini AI**. It features a modern, real-time interface for both quiz creation and participation, all built on a fast and scalable architecture.

---

## ✨ Key Features

- **🤖 AI-Powered Generation**: Create quizzes automatically by providing a topic, difficulty, and number of questions.
- **🌐 Live Hosting**: Host quizzes and invite participants to join with a unique room code.
- **🚀 Modern Tech Stack**: Built with Next.js, TypeScript, TailwindCSS and GSAP for a beautiful and performant frontend.
- **⚙️ Robust Backend**: Powered by Node.js and Express for a scalable and reliable API.
- **🔐 Secure Authentication**: Uses JSON Web Tokens (JWT) stored in secure cookies.
- **🐳 Dockerized**: Comes with a one-command Docker Compose setup for easy local development.
- **☁️ Cloud-Ready**: Includes Kubernetes manifests for scalable deployments.

---

## 🚀 Tech Stack

| Category            | Technology                                                                                                                                                                                                                                                              |
| :------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**        | ![Next.js](https://img.shields.io/badge/-Next.js-000000?style=flat&logo=next.js) ![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?style=flat&logo=typescript) ![GSAP](https://img.shields.io/badge/-GSAP-88CE02?style=flat&logo=greensock&logoColor=white) |
| **Backend**         | ![Node.js](https://img.shields.io/badge/-Node.js-339933?style=flat&logo=nodedotjs) ![Express](https://img.shields.io/badge/-Express-000000?style=flat&logo=express) ![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?style=flat&logo=typescript)           |
| **Database**        | ![MongoDB](https://img.shields.io/badge/-MongoDB-47A248?style=flat&logo=mongodb)                                                                                                                                                                                        |
| **AI**              | [Groq API](https://console.groq.com/)                                                                                                                                                                                                                                   |
| **Deployment**      | ![Docker](https://img.shields.io/badge/-Docker-2496ED?style=flat&logo=docker) ![Kubernetes](https://img.shields.io/badge/-Kubernetes-326CE5?style=flat&logo=kubernetes)                                                                                                 |
| **Package Manager** | ![pnpm](https://img.shields.io/badge/-pnpm-F69220?style=flat&logo=pnpm)                                                                                                                                                                                                 |

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

### Docker Compose makes it super simple to run the frontend, backend, and MongoDB together! 🚀

### Step 1: Start all services

```bash
docker compose -f docker-compose.dev.yml up --build -d
```

### This will:

- Spin up MongoDB 🗄️

- Launch the Backend ⚙️

- Fire up the Frontend 🌐

### Step 2: Check running containers

```bash
docker ps
```

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

- #### Learn: Dive into a modern full-stack app with Next.js, TypeScript, and AI integration.

- #### Impact: Help create a fun, educational tool for students and teachers worldwide.

- #### Community: Join a friendly team of developers passionate about learning and tech! 🤗

- #### Happy coding, and let’s make PopQuiz even more awesome together! 🚀✨
