import type { ReactNode } from 'react';

const ACCENT_COLOR = 'text-sky-700 dark:text-sky-300';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const FIELD_KEY_COLOR = 'text-indigo-500/80 dark:text-[#8b9dc099]';

interface Match {
  length: number;
  className: string;
}

function isWordBoundary(char: string | undefined): boolean {
  if (char === undefined) return true;
  return !/[A-Za-z0-9_]/.test(char);
}

function matchAt(text: string, i: number): Match | null {
  const prev = i > 0 ? text[i - 1] : undefined;
  if (!isWordBoundary(prev)) {
    return null;
  }

  for (const method of HTTP_METHODS) {
    if (
      text.startsWith(method, i) &&
      isWordBoundary(text[i + method.length])
    ) {
      return { length: method.length, className: ACCENT_COLOR };
    }
  }

  const remaining = text.slice(i);

  const uuidMatch = remaining.match(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/,
  );
  if (uuidMatch) {
    return { length: uuidMatch[0].length, className: ACCENT_COLOR };
  }

  const traceIdMatch = remaining.match(/^[0-9a-f]{32}\b/);
  if (traceIdMatch) {
    return { length: traceIdMatch[0].length, className: ACCENT_COLOR };
  }

  const spanIdMatch = remaining.match(/^[0-9a-f]{16}\b/);
  if (spanIdMatch) {
    return { length: spanIdMatch[0].length, className: ACCENT_COLOR };
  }

  const jsonKeyMatch = remaining.match(/^"([a-zA-Z_][a-zA-Z0-9_.-]*)"\s*:/);
  if (jsonKeyMatch) {
    return { length: jsonKeyMatch[1].length + 2, className: FIELD_KEY_COLOR };
  }

  const logfmtKeyMatch = remaining.match(/^([a-zA-Z_][a-zA-Z0-9_.-]*)=/);
  if (logfmtKeyMatch) {
    return { length: logfmtKeyMatch[1].length, className: FIELD_KEY_COLOR };
  }

  const durationMatch = remaining.match(
    /^\d+(?:\.\d+)?(?:ns|µs|us|ms|s|m|h)(?:\d+(?:\.\d+)?(?:ns|µs|us|ms|s|m|h))*\b/,
  );
  if (durationMatch) {
    return { length: durationMatch[0].length, className: ACCENT_COLOR };
  }

  const statusMatch = remaining.match(/^[1-5]\d{2}(?!\.)\b/);
  if (statusMatch && (prev === undefined || /[\s=:]/.test(prev))) {
    return { length: statusMatch[0].length, className: ACCENT_COLOR };
  }

  return null;
}

export interface SearchRange {
  start: number;
  end: number;
  isCurrent: boolean;
}

const SEARCH_HIGHLIGHT_CLASS = 'bg-yellow-300/70 text-foreground dark:bg-yellow-500/40';
const SEARCH_CURRENT_CLASS = 'bg-orange-400/80 text-foreground dark:bg-orange-500/70';

function searchClassAt(
  ranges: SearchRange[] | undefined,
  index: number,
): string | null {
  if (!ranges) return null;
  for (const range of ranges) {
    if (index >= range.start && index < range.end) {
      return range.isCurrent ? SEARCH_CURRENT_CLASS : SEARCH_HIGHLIGHT_CLASS;
    }
  }
  return null;
}

function emitSpan(
  out: ReactNode[],
  text: string,
  start: number,
  end: number,
  syntaxClass: string | null,
  ranges: SearchRange[] | undefined,
): void {
  let cursor = start;
  let segmentStart = start;
  let segmentSearchClass = searchClassAt(ranges, start);

  while (cursor < end) {
    const nextSearchClass = searchClassAt(ranges, cursor);
    if (nextSearchClass !== segmentSearchClass) {
      out.push(
        renderSegment(
          text,
          segmentStart,
          cursor,
          syntaxClass,
          segmentSearchClass,
        ),
      );
      segmentStart = cursor;
      segmentSearchClass = nextSearchClass;
    }
    cursor += 1;
  }
  out.push(
    renderSegment(text, segmentStart, end, syntaxClass, segmentSearchClass),
  );
}

function renderSegment(
  text: string,
  start: number,
  end: number,
  syntaxClass: string | null,
  searchClass: string | null,
): ReactNode {
  const slice = text.slice(start, end);
  const effectiveClass = searchClass ?? syntaxClass;
  if (!effectiveClass) {
    return slice;
  }
  const isCurrent = searchClass === SEARCH_CURRENT_CLASS;
  return (
    <span
      key={start}
      className={effectiveClass}
      data-search-current={isCurrent ? 'true' : undefined}
    >
      {slice}
    </span>
  );
}

export function highlightLog(
  text: string,
  ranges?: SearchRange[],
): ReactNode {
  const out: ReactNode[] = [];
  let plainStart = 0;
  let i = 0;

  while (i < text.length) {
    const match = matchAt(text, i);
    if (match) {
      if (plainStart < i) {
        emitSpan(out, text, plainStart, i, null, ranges);
      }
      emitSpan(out, text, i, i + match.length, match.className, ranges);
      i += match.length;
      plainStart = i;
    } else {
      i += 1;
    }
  }

  if (plainStart < text.length) {
    emitSpan(out, text, plainStart, text.length, null, ranges);
  }

  return out;
}
