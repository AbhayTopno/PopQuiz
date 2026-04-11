"""
FastAPI application entry point.
Responsible ONLY for wiring: settings → providers → service → app state → router.
All business logic lives in chains/ and services/.
"""

import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, get_settings
from app.providers.gemini_provider import GeminiEmbedder, GeminiProvider
from app.providers.qdrant_provider import QdrantVectorStoreProvider
from app.routers.quiz import router as quiz_router
from app.services.quiz_service import QuizService


def _configure_langsmith(settings: Settings) -> None:
    """Push LangSmith env vars so LangChain auto-traces every chain call."""
    if settings.langchain_api_key and settings.langchain_tracing_v2.lower() == "true":
        os.environ.setdefault("LANGCHAIN_TRACING_V2", "true")
        os.environ.setdefault("LANGCHAIN_API_KEY", settings.langchain_api_key)
        os.environ.setdefault("LANGCHAIN_PROJECT", settings.langchain_project)
        os.environ.setdefault("LANGCHAIN_ENDPOINT", settings.langchain_endpoint)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Build the dependency graph once at startup and store on app.state.
    Routers read app.state.quiz_service via request.app.state — no globals needed.
    """
    settings = get_settings()
    _configure_langsmith(settings)

    llm_provider = GeminiProvider(settings)
    embedder = GeminiEmbedder(settings)
    vs_provider = QdrantVectorStoreProvider(embedder, settings)
    app.state.quiz_service = QuizService(llm_provider, vs_provider)

    yield  # app is serving

    # Nothing stateful to shut down


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="PopQuiz LangChain Service",
        description="AI quiz generation — topic-based and RAG (document upload) modes",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ✅ Register the router at CREATION TIME — FastAPI compiles routes here,
    #    not at startup. Using on_event("startup") for include_router() causes 404s.
    app.include_router(quiz_router)

    return app


app = create_app()
