import React from 'react';
import type { SettingsPanelProps } from '@/types';

const difficulties = ['easy', 'medium', 'hard'];

export default function SettingsPanel({
  roomId,
  settings,
  updateSettings,
  isHost,
  copied,
  onCopyLink,
}: SettingsPanelProps) {
  return (
    <div className="space-y-4 flex-1 overflow-y-auto pr-2">
      <div>
        <label className="mb-1 block text-sm text-white/80">Room ID</label>
        <div className="flex gap-2">
          <div className="flex-1 rounded-lg border border-white/20 bg-black/10 shadow-2xl px-3 py-2 font-mono text-sm truncate">
            {roomId}
          </div>
          <button
            onClick={onCopyLink}
            className={`rounded-lg px-3 py-2 text-xs transition-colors whitespace-nowrap ${
              copied ? 'bg-green-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-white/80">Quiz Topic</label>
        <input
          className="w-full rounded-lg border border-white/20 bg-black/10 shadow-2xl px-3 py-2 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          value={settings.topic}
          onChange={(e) => updateSettings({ topic: e.target.value })}
          disabled={!isHost}
          placeholder="Enter topic..."
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-white/80">Difficulty</label>
        <div className="flex gap-2">
          {difficulties.map((d) => (
            <button
              key={d}
              disabled={!isHost}
              onClick={() => updateSettings({ difficulty: d })}
              className={`px-3 py-2 rounded-lg text-sm capitalize transition-colors ${
                settings.difficulty === d
                  ? 'bg-blue-500'
                  : 'bg-white/10 shadow-2xl hover:bg-white/20 disabled:opacity-50'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm text-white/80">Questions</label>
          <input
            type="number"
            min={1}
            max={50}
            className="w-full rounded-lg border border-white/20 bg-black/10 shadow-2xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            value={settings.questionCount}
            onChange={(e) =>
              updateSettings({
                questionCount: Math.min(50, Math.max(1, Number(e.target.value || 1))),
              })
            }
            disabled={!isHost}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-white/80">Duration (sec)</label>
          <input
            type="number"
            min={5}
            max={300}
            className="w-full rounded-lg border border-white/20 bg-black/10 shadow-2xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            value={settings.duration}
            onChange={(e) =>
              updateSettings({
                duration: Math.min(300, Math.max(5, Number(e.target.value || 10))),
              })
            }
            disabled={!isHost}
          />
        </div>
      </div>
    </div>
  );
}
