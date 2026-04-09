// components/QuizPopup.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/lib/config';

interface QuizPopupProps {
  open: boolean;
  onClose: () => void;
  topic: string;
}

const QuizPopup: React.FC<QuizPopupProps> = ({ open, onClose, topic }) => {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const customTeamRef = useRef<HTMLDivElement | null>(null);
  const sourceInputRef = useRef<HTMLInputElement | null>(null);

  const [quizTopic, setQuizTopic] = useState('');
  const [difficulty, setDifficulty] = useState('easy');
  const [questionCount, setQuestionCount] = useState<number | ''>(10);
  const [battleType, setBattleType] = useState('solo');
  const [duration, setDuration] = useState<number | ''>(10);
  const [customTeamA, setCustomTeamA] = useState(1);
  const [customTeamB, setCustomTeamB] = useState(1);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const difficulties = ['easy', 'medium', 'hard'];
  const battleTypes = ['solo', '1v1', '2v2', 'coop', 'custom', 'ffa'];

  // Update topic when prop changes or popup opens
  useEffect(() => {
    if (open && topic) {
      setQuizTopic(topic.toLowerCase());
      setSourceFile(null);
    }
  }, [topic, open]);

  // Animation effect for popup entrance
  useEffect(() => {
    if (open) {
      setError(null);
      setSourceFile(null);
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

  const handlePickSource = () => {
    sourceInputRef.current?.click();
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
    ]);

    if (!allowedTypes.has(file.type)) {
      setError('Only PDF, DOC/DOCX, PNG, JPEG, or WEBP files are supported.');
      e.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be 10MB or less.');
      e.target.value = '';
      return;
    }

    setSourceFile(file);
    setError(null);

    if (!quizTopic.trim()) {
      setQuizTopic(file.name.replace(/\.[^/.]+$/, ''));
    }

    e.target.value = '';
  };

  const handleStart = async () => {
    const trimmedTopic = quizTopic.trim();
    const routingTopic =
      trimmedTopic || sourceFile?.name.replace(/\.[^/.]+$/, '') || 'uploaded-source';

    if (!trimmedTopic && !sourceFile) {
      setError('Please provide a quiz topic or attach a source file.');
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

    try {
      let response: Response;

      if (sourceFile) {
        const formData = new FormData();
        formData.append('file', sourceFile);
        formData.append('difficulty', difficulty);
        formData.append('count', String(finalQuestionCount));

        if (trimmedTopic) {
          formData.append('topic', trimmedTopic);
        }

        response = await fetch(`${getApiUrl()}/api/quiz/generate`, {
          method: 'POST',
          body: formData,
        });
      } else {
        response = await fetch(`${getApiUrl()}/api/quiz/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: trimmedTopic,
            difficulty,
            count: finalQuestionCount,
          }),
        });
      }

      if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let message = 'Failed to generate quiz';

        if (contentType.includes('application/json')) {
          const errorData = (await response.json()) as { message?: string; detail?: string };
          message = errorData.message || errorData.detail || message;
        } else {
          const errorText = await response.text();
          if (errorText) {
            message = errorText;
          }
        }

        throw new Error(message);
      }

      const result = await response.json();

      if (result.quizId) {
        // If 1v1, 2v2, coop, custom, ffa, or multiplayer mode, go to waiting room
        if (
          battleType === '1v1' ||
          battleType === '2v2' ||
          battleType === 'coop' ||
          battleType === 'custom' ||
          battleType === 'ffa'
        ) {
          const roomId = `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const username = 'Player'; // TODO: Get from auth context
          const params = new URLSearchParams({
            roomId,
            quizId: result.quizId,
            username,
            host: '1',
            mode: battleType,
            topic: routingTopic,
            difficulty,
            count: String(finalQuestionCount),
            duration: String(finalDuration),
          });
          router.push(`/waiting-room?${params.toString()}`);
        } else {
          // Solo mode - go directly to quiz
          router.push(`/quiz/${result.quizId}?duration=${finalDuration}`);
        }
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
    'w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base text-white placeholder-white/50 backdrop-blur-sm transition-all focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/50';

  const toggleButtonBaseClass =
    'px-2 py-1.5 sm:px-4 sm:py-2 rounded-lg font-general text-xs sm:text-sm font-semibold uppercase transition-colors';
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
        className="relative w-[95vw] max-w-[90vw] sm:w-full sm:max-w-lg rounded-2xl border border-white/20 bg-black/40 p-4 sm:p-6 md:p-8 shadow-2xl"
        style={{ backdropFilter: 'blur(20px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 text-2xl text-white/70 transition-colors hover:text-white"
        >
          ×
        </button>

        <h2 className="mb-4 sm:mb-6 text-center font-zentry text-xl sm:text-2xl md:text-3xl font-black uppercase text-white">
          {topic ? `Quiz on ${topic}` : 'Create Custom Quiz'}
        </h2>

        <div className="space-y-4">
          {/* Topic Input */}
          <div>
            <label className="mb-1 sm:mb-2 block font-general text-xs sm:text-sm text-white/80">
              Quiz Topic
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={quizTopic}
                onChange={(e) => setQuizTopic(e.target.value)}
                placeholder="Enter quiz topic..."
                className={inputClass}
              />
              <button
                type="button"
                onClick={handlePickSource}
                className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-lg border border-white/20 bg-white/10 text-lg sm:text-xl text-white transition-colors hover:bg-white/20"
                title="Attach PDF, DOC/DOCX, or image"
                aria-label="Attach quiz source file"
              >
                +
              </button>
              <input
                ref={sourceInputRef}
                type="file"
                onChange={handleSourceChange}
                className="hidden"
                accept=".pdf,.doc,.docx,image/png,image/jpeg,image/webp"
              />
            </div>

            {sourceFile && (
              <div className="mt-2 flex items-center justify-between rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-xs sm:text-sm text-blue-100">
                <span className="truncate pr-2">Source: {sourceFile.name}</span>
                <button
                  type="button"
                  onClick={() => setSourceFile(null)}
                  className="rounded px-2 py-1 text-red-600 transition-colors hover:bg-blue-400/20 hover:text-white"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Difficulty */}
          <div>
            <label className="mb-1 sm:mb-2 block font-general text-xs sm:text-sm text-white/80">
              Difficulty
            </label>
            <div className="flex gap-1 sm:gap-2">
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
            <label className="mb-1 sm:mb-2 block font-general text-xs sm:text-sm text-white/80">
              Battle Type
            </label>
            <div className="flex flex-wrap gap-1 sm:gap-2">
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
          <div className="grid grid-cols-2 gap-2 sm:gap-4">
            <div>
              <label className="mb-1 sm:mb-2 block font-general text-xs sm:text-sm text-white/80">
                Questions
              </label>
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
              <label className="mb-1 sm:mb-2 block font-general text-xs sm:text-sm text-white/80">
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
            <div className="rounded-lg bg-red-500/20 border border-red-500/50 px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm text-red-200">
              {error}
            </div>
          )}

          {/* Start Button */}
          <div className="pt-2 sm:pt-4">
            <button
              onClick={handleStart}
              disabled={isSubmitting}
              className="w-full rounded-lg bg-blue-500 px-3 py-2 sm:px-4 sm:py-3 font-general text-sm sm:text-base font-semibold uppercase text-white transition-all hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
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
