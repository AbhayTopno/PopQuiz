import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

const promptPersonas: { [key: string]: string } = {
  easy: `You are a professional quiz master create a beginner quiz on {topic}. Create exactly {count} "easy" questions testing basic understanding.`,
  medium: `You are a professional quiz master create a intermediate quiz on {topic}. Create exactly {count} "medium" questions testing applied knowledge.`,
  hard: `You are a professional quiz master create a advanced quiz on {topic}. Create exactly {count} "hard" questions testing deep critical understanding.`,
};

const jsonResponseInstruction = `
Respond ONLY with valid JSON in this exact format:
{
  "questions": [
    {
      "question": "Question text",
      "options": ["A: Answer A", "B: Answer B", "C: Answer C", "D: Answer D"],
      "answer": "B: Answer B"
    }
  ]
  example: [
  {
    "question": "What is the capital of France?",
    "options": ["A: Berlin", "B: Madrid", "C: Paris", "D: Rome"],
    "answer": "C: Paris"
  }
  ]
}
No explanations, no extra text. Only the JSON object.`;

export async function generateQuiz(
  topic: string,
  difficulty: string = 'medium',
  count: number = 5,
) {
  const persona = promptPersonas[difficulty.toLowerCase()] || promptPersonas.medium;

  const prompt =
    persona.replace('{topic}', topic).replace('{count}', count.toString()) +
    jsonResponseInstruction;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      model: 'llama-3.1-8b-instant',
    });

    const content = chatCompletion.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content returned from Groq');
    }

    const parsedContent = JSON.parse(content);

    // Validate the structure of the AI's response before returning it
    if (!parsedContent.questions || !Array.isArray(parsedContent.questions)) {
      throw new Error(
        'Invalid JSON structure from AI: "questions" array is missing or not an array.',
      );
    }

    console.log('Groq response validated successfully.');
    return parsedContent;
  } catch (err) {
    console.error('Groq Service Error:', err);
    throw new Error('Failed to generate quiz from AI service.');
  }
}
