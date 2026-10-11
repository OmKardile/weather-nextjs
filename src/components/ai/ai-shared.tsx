'use client';

import type { ComponentPropsWithoutRef, JSX } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import { cn } from '@/lib/utils';
import type { AiProvider, AiStreamEvent } from '@/types/ai';

/* ================================================================== */
/* Shared bits for the AI surfaces (briefing, chat, advisor, alerts)   */
/* ================================================================== */

/**
 * Read an NDJSON streaming response line by line, buffering partial lines.
 *
 * Protocol (see src/types/ai.ts): each line is one `AiStreamEvent` —
 * `meta` → `chunk`×N → `done` | `error`. Malformed lines are skipped so a
 * single bad write can never break a stream. `meta` arriving after the
 * first chunk is handled naturally (events are dispatched as they come).
 * Aborts propagate to the caller as an `AbortError` for graceful handling.
 */
export async function readNdjsonStream(
  response: Response,
  onEvent: (event: AiStreamEvent) => void,
): Promise<void> {
  if (!response.body) throw new Error('The response has no body.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatchLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && 'type' in parsed) {
        onEvent(parsed as AiStreamEvent);
      }
    } catch {
      // Ignore malformed lines — the protocol tolerates partial noise.
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        dispatchLine(line);
        newlineIndex = buffer.indexOf('\n');
      }
    }
    // Flush the decoder + any trailing line that arrived without a final
    // newline (defensive — the server always ends with '\n').
    buffer += decoder.decode();
    dispatchLine(buffer);
  } finally {
    reader.releaseLock();
  }
}

/** Tiny provider pill — "AI" (gemini/zai) or "Offline" (rule-based fallback). */
export function AiBadge({ provider }: { provider: AiProvider | null }): JSX.Element | null {
  if (!provider) return null;
  if (provider === 'fallback') {
    return (
      <span
        title="Rule-based answers — AI is offline"
        className="inline-flex items-center gap-1 rounded-full border border-surface bg-[var(--surface-subtle)] px-1.5 py-[3px] text-[9px] font-semibold uppercase leading-none tracking-[0.08em] text-surface-faint"
      >
        <span aria-hidden="true" className="h-1 w-1 rounded-full bg-surface-faint" />
        Offline
      </span>
    );
  }
  return (
    <span
      title="AI-powered"
      className="inline-flex items-center gap-1 rounded-full border border-aurora-500/25 bg-aurora-500/10 px-1.5 py-[3px] text-[9px] font-semibold uppercase leading-none tracking-[0.08em] text-surface-muted"
    >
      <span aria-hidden="true" className="h-1 w-1 rounded-full bg-aurora-400" />
      AI
    </span>
  );
}

/** Soft pulsing caret shown while a reply streams in. */
export function StreamingCursor({ className }: { className?: string }): JSX.Element {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block h-[1em] w-[3px] translate-y-[0.125em] animate-pulse rounded-[1px] bg-aurora-400',
        className,
      )}
    />
  );
}

/* ------------------------------------------------------------------ */
/* MarkdownLite — react-markdown restricted to a safe inline subset     */
/* ------------------------------------------------------------------ */

const MARKDOWN_ELEMENTS = ['p', 'strong', 'em', 'ul', 'ol', 'li', 'code', 'br'] as const;

type ElementChildren = { children?: ComponentPropsWithoutRef<'p'>['children'] };

const markdownComponents: Components = {
  p: ({ children }: ElementChildren) => <p className="m-0 leading-relaxed">{children}</p>,
  strong: ({ children }: ElementChildren) => (
    <strong className="font-semibold text-surface">{children}</strong>
  ),
  em: ({ children }: ElementChildren) => <em className="italic">{children}</em>,
  ul: ({ children }: ElementChildren) => (
    <ul className="my-1.5 ml-1 flex list-disc flex-col gap-0.5 pl-4">{children}</ul>
  ),
  ol: ({ children }: ElementChildren) => (
    <ol className="my-1.5 ml-1 flex list-decimal flex-col gap-0.5 pl-4">{children}</ol>
  ),
  li: ({ children }: ElementChildren) => (
    <li className="leading-relaxed marker:text-surface-faint">{children}</li>
  ),
  code: ({ children }: ElementChildren) => (
    <code className="rounded-md border border-surface bg-[rgb(var(--glass-tint)/0.12)] px-1.5 py-0.5 font-mono text-[0.85em] not-italic text-surface">
      {children}
    </code>
  ),
  br: () => <br />,
};

/**
 * Markdown renderer for AI replies. Only p/strong/em/ul/ol/li/code/br are
 * allowed — links, images, headings and raw HTML are stripped entirely, and
 * `urlTransform` neutralises hrefs as a second line of defence.
 */
export function MarkdownLite({ text, className }: { text: string; className?: string }): JSX.Element {
  return (
    <div className={className}>
      <ReactMarkdown
        allowedElements={MARKDOWN_ELEMENTS}
        skipHtml
        urlTransform={() => ''}
        components={markdownComponents}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
