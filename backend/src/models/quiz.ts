import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: [true, "Question text is required."],
  },
  options: [
    {
      type: String,
      required: [true, "At least one option is required."],
    },
  ],
  correctAnswer: {
    type: String,
    required: [true, "A correct answer is required."],
  },
});

const quizSchema = new mongoose.Schema(
  {
    hostedBy: {
      type: String,
      default: "Admin",
    },
    topic: {
      type: String,
      required: [true, "A topic is required."],
      trim: true,
      index: true, // Speeds up queries that filter by topic
    },
    difficulty: {
      type: String,
      required: [true, "A difficulty level is required."],
      enum: ["easy", "medium", "hard"],
    },
    numberOfQuestions: {
      type: Number,
      required: [true, "Number of questions is required."],
      immutable: true,
    },
    questions: [questionSchema],
  },
  { timestamps: true },
);

export const Quiz = mongoose.model("Quiz", quizSchema);
