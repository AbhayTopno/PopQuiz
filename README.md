# 📚 PopQuiz — AI Powered Quiz Generator

PopQuiz is a full-stack web application that allows users to **generate quizzes automatically using Gemini AI**.  
It supports customizable quiz generation by topic, difficulty, and number of questions, while providing a modern, fast, and scalable architecture.

---

# 🚀 Tech Stack

- **Frontend:** Next.js + TypeScript + TailwindCSS (using **pnpm** for package management)
- **Backend:** Node.js + Express + TypeScript
- **Database:** MongoDB
- **Authentication:** JWT + Cookies
- **AI Integration:** [Groq API](https://console.groq.com/)
- **Deployment:** Nginx + Docker
- **Package Manager:** pnpm (faster than npm/yarn with better caching)

---

# 🛠️ Local Development Setup

Follow these steps to get the project running locally:

## Clone the repository

```bash
git clone https://github.com/your-username/popquiz.git
cd popquiz
```

## 🛠️ Backend Setup

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

### The frontend is a sleek Next.js + TypeScript + TailwindCSS setup—beautiful and blazing fast! 🌈

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

## 🐳 Run with Docker (Recommended) 🐳

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

## Visit http://localhost:3000 for the frontend 🎉

## Backend runs at http://localhost:5000/api 🛠️

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

### 🔑 API Key Notes ⚠️

### A Groq API Key is required for quiz generation. Keep it safe! 🔒

## Never share your .env file publicly.

### If your key is leaked, revoke it immediately from the Groq Console.

# Why Contribute to PopQuiz?

#### Learn: Dive into a modern full-stack app with Next.js, TypeScript, and AI integration.

#### Impact: Help create a fun, educational tool for students and teachers worldwide.

#### Community: Join a friendly team of developers passionate about learning and tech! 🤗

#### Happy coding, and let’s make PopQuiz even more awesome together! 🚀✨
