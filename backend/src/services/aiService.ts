import dotenv from 'dotenv';

dotenv.config();

const LANGCHAIN_SERVICE_URL = process.env.LANGCHAIN_SERVICE_URL ?? 'http://localhost:8000';

type LangChainQuizResponse = {
  questions: unknown[];
};

const validateQuizResponse = async (response: Response) => {
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LangChain service error ${response.status}: ${errorBody}`);
  }

  const parsedContent = (await response.json()) as LangChainQuizResponse;

  if (!parsedContent.questions || !Array.isArray(parsedContent.questions)) {
    throw new Error('Invalid response from LangChain service: "questions" array is missing.');
  }

  return parsedContent;
};

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

  const parsedContent = await validateQuizResponse(response);
  console.log('LangChain topic response validated successfully.');
  return parsedContent;
}

/**
 * Calls LangChain RAG endpoint for uploaded files (document or image).
 */
export async function generateQuizFromFile(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  difficulty: string = 'medium',
  count: number = 5,
  topic?: string,
) {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType || 'application/octet-stream' });
  formData.append('file', blob, filename);
  formData.append('difficulty', difficulty);
  formData.append('count', String(count));

  if (topic?.trim()) {
    formData.append('topic', topic.trim());
  }

  const response = await fetch(`${LANGCHAIN_SERVICE_URL}/api/v1/rag-generate`, {
    method: 'POST',
    body: formData,
  });

  const parsedContent = await validateQuizResponse(response);
  console.log('LangChain upload response validated successfully.');
  return parsedContent;
}
