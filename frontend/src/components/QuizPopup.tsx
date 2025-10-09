// components/QuizPopup.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useRouter } from 'next/navigation';

interface QuizPopupProps {
  open: boolean;
  onClose: () => void;
  topic: string;
}

const QuizPopup: React.FC<QuizPopupProps> = ({ open, onClose, topic }) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const customTeamRef = useRef<HTMLDivElement | null>(null);

  const [quizTopic, setQuizTopic] = useState('');
  const [difficulty, setDifficulty] = useState('easy');
  const [questionCount, setQuestionCount] = useState<number | ''>(10);
  const [battleType, setBattleType] = useState('solo');
  const [duration, setDuration] = useState<number | ''>(10);
  const [customTeamA, setCustomTeamA] = useState(1);
  const [customTeamB, setCustomTeamB] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const difficulties = ['easy', 'medium', 'hard'];
  const battleTypes = ['solo', '1v1', '2v2', 'custom'];

  // Update topic when prop changes or popup opens
  useEffect(() => {
    if (open && topic) {
      setQuizTopic(topic.toLowerCase());
    }
  }, [topic, open]);

  // Animation effect for popup entrance
  useEffect(() => {
    if (open) {
      setError(null);
      gsap.fromTo(
        overlayRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: 'power2.out' },
      );
      gsap.fromTo(
        popupRef.current,
        { scale: 0.8, opacity: 0, y: 50 },
        { scale: 1, opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.7)' },
      );
    }
  }, [open]);

  // Animation effect for custom battle type dropdown
  useEffect(() => {
    if (battleType === 'custom') {
      gsap.to(customTeamRef.current, {
        height: 'auto',
        opacity: 1,
        marginTop: '1rem',
        duration: 0.4,
        ease: 'power2.out',
      });
    } else {
      gsap.to(customTeamRef.current, {
        height: 0,
        opacity: 0,
        marginTop: '0rem',
        duration: 0.3,
        ease: 'power2.in',
      });
    }
  }, [battleType]);

  const handleClose = () => {
    if (overlayRef.current && popupRef.current) {
      gsap.to(popupRef.current, {
        scale: 0.8,
        opacity: 0,
        y: 50,
        duration: 0.3,
        ease: 'power2.in',
      });
      gsap.to(overlayRef.current, {
        opacity: 0,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: onClose,
      });
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleStart = async () => {
    if (!quizTopic.trim()) {
      setError('Please provide a quiz topic');
      return;
    }

    const finalQuestionCount = questionCount === '' ? 10 : questionCount;
    const finalDuration = duration === '' ? 10 : duration;

    if (finalQuestionCount < 1 || finalQuestionCount > 50) {
      setError('Question count must be between 1 and 50');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const data = {
      topic: quizTopic.trim(),
      difficulty,
      count: finalQuestionCount,
    };

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/quiz/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate quiz');
      }

      const result = await response.json();

      if (result.quizId) {
        router.push(`/quiz/${result.quizId}?duration=${finalDuration}`);
        handleClose();
      } else {
        throw new Error('No quiz ID returned from server');
      }
    } catch (error) {
      // ✅ Log only in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Error generating quiz:', error);
      }
      setError(
        error instanceof Error ? error.message : 'Failed to generate quiz. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  const inputClass =
    'w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-white/50 backdrop-blur-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50';

  const toggleButtonBaseClass =
    'px-4 py-2 rounded-lg font-general text-sm font-semibold uppercase transition-colors';
  const toggleButtonActiveClass = 'bg-blue-500 text-white';
  const toggleButtonInactiveClass = 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white';

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={handleOverlayClick}
      style={{
        backdropFilter: 'blur(10px)',
        backgroundColor: 'rgba(0,0,0,0.5)',
      }}
    >
      <div
        ref={popupRef}
        className="relative w-full max-w-lg rounded-2xl border border-white/20 bg-black/40 p-8 shadow-2xl"
        style={{ backdropFilter: 'blur(20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 text-2xl text-white/70 transition-colors hover:text-white"
        >
          ×
        </button>

        <h2 className="mb-6 text-center font-zentry text-3xl font-black uppercase text-white">
          {topic ? `Quiz on ${topic}` : 'Create Custom Quiz'}
        </h2>

        <div className="space-y-4">
          {/* Topic Input */}
          <div>
            <label className="mb-2 block font-general text-sm text-white/80">Quiz Topic</label>
            <input
              type="text"
              value={quizTopic}
              onChange={(e) => setQuizTopic(e.target.value)}
              placeholder="Enter quiz topic..."
              className={inputClass}
            />
          </div>

          {/* Difficulty */}
          <div>
            <label className="mb-2 block font-general text-sm text-white/80">Difficulty</label>
            <div className="flex gap-2">
              {difficulties.map((d) => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`${toggleButtonBaseClass} ${
                    difficulty === d ? toggleButtonActiveClass : toggleButtonInactiveClass
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Battle Type */}
          <div>
            <label className="mb-2 block font-general text-sm text-white/80">Battle Type</label>
            <div className="flex flex-wrap gap-2">
              {battleTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => setBattleType(type)}
                  className={`${toggleButtonBaseClass} ${
                    battleType === type ? toggleButtonActiveClass : toggleButtonInactiveClass
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Teams */}
          <div ref={customTeamRef} className="h-0 space-y-4 overflow-hidden opacity-0">
            <label className="block font-general text-sm text-white/80">Custom Teams</label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={customTeamA}
                onChange={(e) => setCustomTeamA(parseInt(e.target.value) || 1)}
                className={`${inputClass} text-center`}
                min={1}
              />
              <span className="font-general text-sm text-white/70">vs</span>
              <input
                type="number"
                value={customTeamB}
                onChange={(e) => setCustomTeamB(parseInt(e.target.value) || 1)}
                className={`${inputClass} text-center`}
                min={1}
              />
            </div>
          </div>

          {/* Questions & Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block font-general text-sm text-white/80">Questions</label>
              <input
                type="number"
                value={questionCount}
                onChange={(e) =>
                  setQuestionCount(e.target.value === '' ? '' : parseInt(e.target.value))
                }
                className={inputClass}
                min={1}
                max={50}
              />
            </div>

            <div>
              <label className="mb-2 block font-general text-sm text-white/80">
                Duration (sec)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value === '' ? '' : parseInt(e.target.value))}
                className={inputClass}
                min={5}
                max={300}
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="rounded-lg bg-red-500/20 border border-red-500/50 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {/* Start Button */}
          <div className="pt-4">
            <button
              onClick={handleStart}
              disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-500 px-4 py-3 font-general font-semibold uppercase text-white transition-all hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Generating...' : 'Ikuzo!'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuizPopup;
