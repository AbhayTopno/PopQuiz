"""
Topic-based quiz generation chain.
"""

from langchain_core.prompts import ChatPromptTemplate

from app.interfaces.llm_provider import ILLMProvider
from app.utils.parser import extract_quiz_json

# ── Persona prompts (mirrored from the existing aiService.ts) ─────────────────
_PERSONAS: dict[str, str] = {
    "easy": (
        "You are a professional quiz master. Create a beginner quiz on {topic}. "
        "Generate exactly {count} 'easy' questions testing basic understanding."
    ),
    "medium": (
        "You are a professional quiz master. Create an intermediate quiz on {topic}. "
        "Generate exactly {count} 'medium' questions testing applied knowledge."
    ),
    "hard": (
        "You are a professional quiz master. Create an advanced quiz on {topic}. "
        "Generate exactly {count} 'hard' questions testing deep critical understanding."
    ),
}

_JSON_INSTRUCTION = """
Respond ONLY with valid JSON in this exact format — no extra text, no markdown:
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

_PROMPT = ChatPromptTemplate.from_messages(
    [
        ("system", "{persona}" + _JSON_INSTRUCTION),
        ("human", "Generate the quiz now."),
    ]
)


class TopicChain:
    """
    Encapsulates a topic-based quiz generation pipeline.
    Accepts an ILLMProvider so the concrete model stays swappable.
    """

    def __init__(self, llm_provider: ILLMProvider) -> None:
        self._llm = llm_provider.get_llm()

    async def run(self, topic: str, difficulty: str, count: int) -> dict:
        """
        Build the prompt, stream to the LLM, parse and return quiz JSON.

        Returns:
            dict with a "questions" key, matching the existing API contract.
        """
        persona = _PERSONAS.get(difficulty.lower(), _PERSONAS["medium"])
        chain = _PROMPT | self._llm

        response = await chain.ainvoke(
            {"persona": persona.format(topic=topic, count=count)}
        )

        raw_text: str = (
            response.content if hasattr(response, "content") else str(response)
        )
        return extract_quiz_json(raw_text)
