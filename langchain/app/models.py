"""
Pydantic request / response schemas.
Follows SRP: this module ONLY defines data shapes — no business logic.

All shapes are intentionally kept identical to the existing Express backend
contract so quiz.service.ts requires zero changes.
"""

from pydantic import BaseModel, Field


# ── Request schemas ──────────────────────────────────────────────────────────


class TopicQuizRequest(BaseModel):
    topic: str = Field(..., min_length=2, description="Quiz topic / subject")
    difficulty: str = Field(
        default="medium",
        pattern="^(easy|medium|hard)$",
        description="Difficulty level",
    )
    count: int = Field(default=5, ge=1, le=20, description="Number of questions")


# ── Response schemas ─────────────────────────────────────────────────────────


class QuizQuestion(BaseModel):
    question: str
    options: list[str] = Field(..., description='["A: ...", "B: ...", "C: ...", "D: ..."]')
    answer: str


class QuizResponse(BaseModel):
    questions: list[QuizQuestion]


# ── Health ────────────────────────────────────────────────────────────────────


class HealthResponse(BaseModel):
    status: str
    service: str = "popquiz-langchain"
