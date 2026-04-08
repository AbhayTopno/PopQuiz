"""
Quiz HTTP router — thin layer between FastAPI and QuizService.
Follows SRP: ONLY handles HTTP concerns (request parsing, response serialization, error mapping).

Service is accessed via request.app.state so the router can be registered at
creation time (not deferred to startup), which is required for FastAPI to compile
its route table correctly.
"""

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, status

from app.models import HealthResponse, QuizResponse, TopicQuizRequest
from app.services.quiz_service import QuizService

router = APIRouter(prefix="/api/v1", tags=["quiz"])


def _get_service(request: Request) -> QuizService:
    """Pull QuizService from app state — set once in lifespan."""
    return request.app.state.quiz_service


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok")


@router.post(
    "/generate",
    response_model=QuizResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate quiz from a topic",
)
async def generate_from_topic(
    request: Request,
    body: TopicQuizRequest,
) -> QuizResponse:
    """
    Generate a structured quiz from a given topic, difficulty, and question count.
    Drop-in replacement for the old Groq-based endpoint — same JSON contract.
    """
    quiz_service = _get_service(request)
    try:
        return await quiz_service.generate_from_topic(
            body.topic, body.difficulty, body.count
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Quiz generation failed: {e}",
        )


@router.post(
    "/rag-generate",
    response_model=QuizResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate quiz from an uploaded document (RAG)",
)
async def generate_from_document(
    request: Request,
    file: UploadFile = File(..., description="PDF or DOCX document"),
    difficulty: str = Form(default="medium", pattern="^(easy|medium|hard)$"),
    count: int = Form(default=5, ge=1, le=20),
) -> QuizResponse:
    """Accept a PDF/DOCX, extract content via RAG, return a grounded quiz."""
    if file.content_type not in (
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PDF and DOCX files are supported.",
        )

    file_bytes = await file.read()
    filename = file.filename or "upload"
    quiz_service = _get_service(request)

    try:
        return await quiz_service.generate_from_document(
            file_bytes, filename, difficulty, count
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RAG generation failed: {e}",
        )
