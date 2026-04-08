"""
Structured output parser utilities.
Follows SRP: ONLY responsible for extracting and validating quiz JSON from LLM text.
"""

import json
import re


def extract_quiz_json(raw: str | list) -> dict:
    """
    Extract the first valid JSON object from the LLM response.

    The LLM sometimes wraps JSON in markdown code fences.
    Also, some LLMs (like Gemini) may return content as a list of blocks.
    """
    if isinstance(raw, list):
        # Join list of blocks into a single string
        raw = "".join(
            block if isinstance(block, str) else block.get("text", "")
            for block in raw
            if isinstance(block, (str, dict))
        )

    # Strip markdown fences if present
    cleaned = re.sub(r"```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
    cleaned = re.sub(r"```", "", cleaned)

    # Find the outermost JSON object
    match = re.search(r"\{.*\}", cleaned, flags=re.DOTALL)
    if not match:
        raise ValueError(f"No JSON object found in LLM response:\n{raw}")

    parsed = json.loads(match.group())

    # Validate contract: must have a "questions" list
    if "questions" not in parsed or not isinstance(parsed["questions"], list):
        raise ValueError(
            'LLM returned JSON but it lacks a valid "questions" array. '
            f"Got keys: {list(parsed.keys())}"
        )

    return parsed
