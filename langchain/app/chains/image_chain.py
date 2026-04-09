"""
Image-based quiz generation chain.
Follows SRP: ONLY handles image-to-quiz generation with the multimodal LLM.
"""

import base64

from langchain_core.messages import HumanMessage

from app.interfaces.llm_provider import ILLMProvider
from app.utils.parser import extract_quiz_json


_IMAGE_PROMPT = """
You are a professional quiz master.

Rules:
1) Use ONLY the uploaded image as source material. Do NOT use outside knowledge.
2) If topic_hint is provided, prioritize that scope while still staying inside image material.
3) If the image has no readable educational content/text, generate a random general-knowledge quiz.

Topic hint: {topic_hint}

Generate exactly {count} '{difficulty}' difficulty quiz questions.
Respond ONLY with valid JSON — no markdown, no extra text:
{{
  "questions": [
    {{
      "question": "Question text",
      "options": ["A: Answer A", "B: Answer B", "C: Answer C", "D: Answer D"],
      "answer": "B: Answer B"
    }}
  ]
}}
"""


class ImageChain:
    """Generate a quiz from an uploaded image using the multimodal chat model."""

    def __init__(self, llm_provider: ILLMProvider) -> None:
        self._llm = llm_provider.get_llm()

    async def run(
        self,
        file_bytes: bytes,
        mime_type: str,
        difficulty: str,
        count: int,
        topic: str | None = None,
    ) -> dict:
        prompt = _IMAGE_PROMPT.format(
            topic_hint=(topic or "").strip() or "none",
            difficulty=difficulty,
            count=count,
        )

        encoded = base64.b64encode(file_bytes).decode("utf-8")
        image_data_url = f"data:{mime_type};base64,{encoded}"

        message = HumanMessage(
            content=[
                {"type": "text", "text": prompt},
                {"type": "image_url", "image_url": image_data_url},
            ]
        )

        response = await self._llm.ainvoke([message])
        raw_text: str = (
            response.content if hasattr(response, "content") else str(response)
        )
        return extract_quiz_json(raw_text)