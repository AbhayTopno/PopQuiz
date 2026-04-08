import dotenv from 'dotenv';

dotenv.config();

const LANGCHAIN_SERVICE_URL = process.env.LANGCHAIN_SERVICE_URL ?? 'http://localhost:8000';

/**
 * Calls the LangChain FastAPI microservice to generate a quiz from a topic.
 * Response shape is identical to the previous Groq implementation so
 * quiz.service.ts requires no changes.
 */
export async function generateQuiz(
  topic: string,
  difficulty: string = 'medium',
  count: number = 5,
) {
  const response = await fetch(`${LANGCHAIN_SERVICE_URL}/api/v1/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, difficulty, count }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LangChain service error ${response.status}: ${errorBody}`);
  }

  const parsedContent = (await response.json()) as { questions: unknown[] };

  if (!parsedContent.questions || !Array.isArray(parsedContent.questions)) {
    throw new Error('Invalid response from LangChain service: "questions" array is missing.');
  }

  console.log('LangChain service response validated successfully.');
  return parsedContent;
}
