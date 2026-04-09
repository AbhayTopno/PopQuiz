"""
Quiz HTTP router — thin layer between FastAPI and QuizService.
Follows SRP: ONLY handles HTTP concerns (request parsing, response serialization, error mapping).

Service is accessed via request.app.state so the router can be registered at
creation time (not deferred to startup), which is required for FastAPI to compile
its route table correctly.
"""

from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile, status

from app.models import HealthResponse, QuizResponse, TopicQuizRequest
from app.services.quiz_service import QuizService

router = APIRouter(prefix="/api/v1", tags=["quiz"])

_DOCUMENT_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}
_DOCUMENT_SUFFIXES = {".pdf", ".docx", ".doc"}

_IMAGE_MIME_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
_IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}


def _infer_image_mime(mime_type: str, suffix: str) -> str:
    normalized = mime_type.lower().strip()
    if normalized in _IMAGE_MIME_TYPES:
        return "image/jpeg" if normalized == "image/jpg" else normalized

    by_suffix = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
    }
    return by_suffix.get(suffix, "image/png")


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
    summary="Generate quiz from an uploaded document or image",
)
async def generate_from_document(
    request: Request,
    file: UploadFile = File(..., description="PDF/DOCX document or PNG/JPEG/WEBP image"),
    difficulty: str = Form(default="medium", pattern="^(easy|medium|hard)$"),
    count: int = Form(default=5, ge=1, le=20),
    topic: str | None = Form(default=None, max_length=200),
) -> QuizResponse:
    """Accept a document/image upload and return a grounded quiz."""
    filename = file.filename or "upload"
    suffix = Path(filename).suffix.lower()
    mime_type = (file.content_type or "").lower().strip()

    is_document = mime_type in _DOCUMENT_MIME_TYPES or suffix in _DOCUMENT_SUFFIXES
    is_image = mime_type in _IMAGE_MIME_TYPES or suffix in _IMAGE_SUFFIXES

    if not is_document and not is_image:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Supported files: PDF, DOC/DOCX, PNG, JPEG, WEBP.",
        )

    file_bytes = await file.read()
    quiz_service = _get_service(request)

    try:
        if is_image:
            resolved_mime = _infer_image_mime(mime_type, suffix)
            return await quiz_service.generate_from_image(
                file_bytes, resolved_mime, difficulty, count, topic
            )

        return await quiz_service.generate_from_document(
            file_bytes, filename, difficulty, count, topic
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"RAG generation failed: {e}",
        )
