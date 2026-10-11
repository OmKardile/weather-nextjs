'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { readNdjsonStream } from '@/components/ai/ai-shared';
import type { AiProvider, AiStreamEvent } from '@/types/ai';
import type { City, Units } from '@/types/weather';

/* ================================================================== */
/* useAiChat — streaming NDJSON chat client for /api/ai/chat           */
/* ================================================================== */

export interface UiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export type AiChatStatus = 'idle' | 'streaming' | 'error';

export interface UseAiChatOptions {
  /** City the conversation is grounded in. `send` is a no-op without one. */
  city: City | null;
  units: Units;
}

export interface UseAiChatResult {
  /** Full conversation, including the in-flight assistant message. */
  messages: UiChatMessage[];
  status: AiChatStatus;
  /** Provider behind the most recent response (null before the first reply). */
  provider: AiProvider | null;
  /** No-op while streaming or for empty / over-600-character input. */
  send: (text: string) => void;
  /** Abort the in-flight request, keeping any partial reply. */
  stop: () => void;
  /** Drop the last assistant reply and re-ask the last user message. */
  regenerate: () => void;
  /** Clear the conversation (aborts any in-flight request first). */
  reset: () => void;
  lastError: string | null;
}

/** Wire payload caps — the server re-validates both. */
const MAX_TURNS = 8;
const MAX_CHARS = 600;
const GENERIC_ERROR = 'Ask AI is unavailable right now — try again in a moment.';

let fallbackIdCounter = 0;

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  fallbackIdCounter += 1;
  return `msg-${Date.now().toString(36)}-${fallbackIdCounter}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function useAiChat(options?: UseAiChatOptions): UseAiChatResult {
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [status, setStatus] = useState<AiChatStatus>('idle');
  const [lastError, setLastError] = useState<string | null>(null);
  const [provider, setProvider] = useState<AiProvider | null>(null);

  /* Ref mirrors kept in sync with every state write so the async stream
   * loop and the imperative handlers always read fresh values without
   * depending on render timing. */
  const messagesRef = useRef<UiChatMessage[]>([]);
  const statusRef = useRef<AiChatStatus>('idle');
  const abortRef = useRef<AbortController | null>(null);
  /** Bumped by reset()/unmount to invalidate stale async work. */
  const epochRef = useRef(0);
  /** Latest city/units, refreshed after every render. */
  const contextRef = useRef<UseAiChatOptions | null>(options ?? null);

  useEffect(() => {
    contextRef.current = options ?? null;
  });

  const commitMessages = useCallback((next: UiChatMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  const commitStatus = useCallback((next: AiChatStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  /**
   * Issue one streaming request. `history` is the finalized conversation
   * INCLUDING the user turn to answer (it must end with a user message).
   */
  const runRequest = useCallback(
    (history: UiChatMessage[]) => {
      const context = contextRef.current;
      if (!context?.city) return;
      const { city, units } = context;
      const assistantId = newId();
      const epoch = epochRef.current;
      const controller = new AbortController();
      abortRef.current = controller;

      commitMessages([...history, { id: assistantId, role: 'assistant', content: '' }]);
      commitStatus('streaming');
      setLastError(null);

      const finish = (failure: string | null) => {
        if (epochRef.current !== epoch) return; // stale — reset() won
        if (abortRef.current === controller) abortRef.current = null;
        if (failure) {
          const current = messagesRef.current;
          const index = current.findIndex((message) => message.id === assistantId);
          // Keep the partial reply; drop the placeholder only if no text
          // ever arrived.
          if (index >= 0 && !current[index].content) {
            commitMessages(current.filter((message) => message.id !== assistantId));
          }
          commitStatus('error');
          setLastError(failure);
        } else {
          commitStatus('idle');
        }
      };

      void (async () => {
        let sawTerminalEvent = false;
        let streamError: string | null = null;
        try {
          const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              city: {
                name: city.name,
                country: city.country,
                latitude: city.latitude,
                longitude: city.longitude,
              },
              units,
              messages: history
                .slice(-MAX_TURNS)
                .map((message) => ({ role: message.role, content: message.content })),
            }),
            signal: controller.signal,
          });

          if (!response.ok || !response.body) {
            let message = GENERIC_ERROR;
            try {
              const data = (await response.json()) as { error?: unknown };
              if (typeof data?.error === 'string' && data.error) message = data.error;
            } catch {
              // Non-JSON error body — keep the calm default.
            }
            finish(message);
            return;
          }

          await readNdjsonStream(response, (event: AiStreamEvent) => {
            if (epochRef.current !== epoch) return;
            switch (event.type) {
              case 'meta':
                setProvider(event.provider);
                return;
              case 'chunk': {
                const current = messagesRef.current;
                const index = current.findIndex((message) => message.id === assistantId);
                if (index >= 0) {
                  const next = current.slice();
                  next[index] = { ...next[index], content: next[index].content + event.text };
                  commitMessages(next);
                }
                return;
              }
              case 'done':
                sawTerminalEvent = true;
                return;
              case 'error':
                sawTerminalEvent = true;
                streamError = event.message || 'The reply was interrupted.';
                return;
              default:
                return;
            }
          });

          if (epochRef.current !== epoch) return;
          // A stream that ends without done/error was cut off mid-flight.
          finish(streamError ?? (sawTerminalEvent ? null : 'The reply was interrupted.'));
        } catch (error) {
          if (epochRef.current !== epoch) return;
          // stop() aborts intentionally: keep the partial reply, no error.
          finish(isAbortError(error) ? null : GENERIC_ERROR);
        }
      })();
    },
    [commitMessages, commitStatus],
  );

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || trimmed.length > MAX_CHARS) return;
      if (statusRef.current === 'streaming') return;
      if (!contextRef.current?.city) return;
      const userMessage: UiChatMessage = { id: newId(), role: 'user', content: trimmed };
      runRequest([...messagesRef.current, userMessage]);
    },
    [runRequest],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const regenerate = useCallback(() => {
    if (statusRef.current === 'streaming') return;
    const history = messagesRef.current.slice();
    if (!history.length) return;
    if (history[history.length - 1].role === 'assistant') history.pop();
    const last = history[history.length - 1];
    if (!last || last.role !== 'user') return;
    runRequest(history);
  }, [runRequest]);

  const reset = useCallback(() => {
    epochRef.current += 1; // invalidate any in-flight stream
    abortRef.current?.abort();
    abortRef.current = null;
    commitMessages([]);
    commitStatus('idle');
    setLastError(null);
  }, [commitMessages, commitStatus]);

  // Abort on unmount; the epoch bump keeps the dying stream silent.
  useEffect(() => {
    return () => {
      epochRef.current += 1;
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  return { messages, status, provider, send, stop, regenerate, reset, lastError };
}
