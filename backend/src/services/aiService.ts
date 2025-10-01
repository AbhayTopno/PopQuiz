import Groq from 'groq-sdk';
import dotenv from 'dotenv';

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY!,
});

// Object to hold the unique part of each prompt
const promptPersonas: { [key: string]: string } = {
  easy: `Imagine you are a university professor creating a quiz for an introductory '101' course on the topic: {topic}.

Generate an "easy" quiz with exactly {count} questions to assess a student's understanding of the most fundamental concepts. The questions should test for core definitions, key terminology, and major, widely-known facts.`,

  medium: `Imagine you are a university professor creating a mid-term exam for an undergraduate course on the topic: {topic}.

Generate a "medium" difficulty quiz with exactly {count} questions designed to test if students can apply concepts and connect different ideas. Questions should go beyond simple recall and require an understanding of cause-and-effect, comparisons between key ideas, and the application of knowledge to simple scenarios.`,

  hard: `Imagine you are a university professor setting the final exam for a graduate-level seminar on the topic: {topic}.

Generate a "hard" quiz with exactly {count} questions designed to challenge the most knowledgeable students. The questions must test for a deep, critical understanding of non-obvious facts, nuances, edge cases, and the synthesis of multiple complex concepts. The goal is to differentiate true experts.`,
};

// Common instructions that apply to all prompts
const jsonResponseInstruction = `
Your response must be only the raw JSON object, adhering strictly to this structure:
{
  "questions": [
    {
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "answer": "A"
    }
  ]
}`;

export async function generateQuiz(
  topic: string,
  difficulty: string = 'medium',
  count: number = 5
) {
  // Select the persona, defaulting to medium if the key doesn't exist
  const persona =
    promptPersonas[difficulty.toLowerCase()] || promptPersonas.medium;

  // Build the final prompt
  const prompt =
    persona.replace('{topic}', topic).replace('{count}', count.toString()) +
    jsonResponseInstruction;

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      model: 'llama-3.1-8b-instant', // A current, fast model on Groq
    });

    const content = chatCompletion.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content returned from Groq');
    }

    console.log('Groq raw response:', content);

    return JSON.parse(content);
  } catch (err) {
    console.error('Groq Error:', err);
    return { error: 'Failed to generate quiz' };
  }
}
