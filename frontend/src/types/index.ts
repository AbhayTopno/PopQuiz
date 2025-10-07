// Export the type so it can be imported by other files
export type ButtonProps = {
  id?: string;
  title: string;
  rightIcon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  containerClass?: string;
  onClick?: () => void;
};

export interface AnimatedTitleProps {
  title: string;
  containerClass?: string;
}

export interface ImageClipBoxProps {
  src: string;
  clipClass: string;
}

export interface BentoTiltProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export interface BentoCardProps {
  src: string;
  title: React.ReactNode;
  description?: string;
  isComingSoon?: boolean;
  onOpen?: () => void;
  topic?: string;
}

export interface SocialLink {
  href: string;
  icon: React.ReactElement;
}

export interface Question {
  questionText: string;
  options: string[];
  correctAnswer: string;
}

export interface QuizData {
  _id: string;
  topic: string;
  difficulty: string;
  numberOfQuestions: number;
  questions: Question[];
  hostedBy: string;
}

export type Props = {
  initialQuizData: QuizData;
  initialDuration?: number;
};
