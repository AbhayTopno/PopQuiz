import React, { useRef, useEffect } from 'react';
import type { ChatBoxProps } from '@/types';

export default function ChatBox({
  messages,
  messageInput,
  setMessageInput,
  onSendMessage,
  connected,
}: ChatBoxProps) {
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  const initial = (n: string) => (n && n.trim() ? n.trim()[0].toUpperCase() : 'U');

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      <div className="mb-2 text-sm font-semibold uppercase text-white/80">Chat</div>
      <div className="flex-1 overflow-hidden mb-2">
        <div
          ref={chatContainerRef}
          className="h-full overflow-auto rounded-lg border border-white/10 bg-black/30 p-2 text-xs"
        >
          {messages.length === 0 && <div className="text-white/60">No messages yet.</div>}
          {messages.map((msg, idx) => {
            const showHeader =
              msg.system ||
              idx === 0 ||
              messages[idx - 1].system ||
              messages[idx - 1].name !== msg.name;
            return (
              <div key={`${msg.id}-${msg.ts}`} className={showHeader ? 'mb-2' : 'mb-1 pl-7'}>
                {msg.system ? (
                  <div className="text-center text-white/50 italic py-1">{msg.text}</div>
                ) : (
                  <>
                    {showHeader && (
                      <div className="flex items-center gap-2 mb-1 p-2">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-white/90 text-[10px]">
                          {initial(msg.name)}
                        </div>
                        <span className="text-white/70 text-[11px]">{msg.name}</span>
                      </div>
                    )}
                    <div className={!showHeader ? 'text-white/90' : 'pl-7 text-white/90'}>
                      {msg.text}
                    </div>
                  </>
                )}
              </div>
            );
          })}
          <div ref={messageEndRef} />
        </div>
      </div>

      <form onSubmit={onSendMessage} className="flex gap-2">
        <input
          className="flex-1 rounded-lg border border-white/20 bg-black/10 shadow-2xl px-3 py-2 font-mono text-sm truncate"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          placeholder="Type a message…"
          disabled={!connected}
        />
        <button
          disabled={!connected}
          className="rounded-lg bg-blue-500 px-4 py-2 text-sm hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          Send
        </button>
      </form>
      {!connected && <div className="mt-2 text-xs text-red-400">Disconnected from server…</div>}
    </>
  );
}
