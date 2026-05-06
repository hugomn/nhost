import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Table } from '@/components/ui/v2/Table';
import { TableBody } from '@/components/ui/v2/TableBody';
import { TableCell } from '@/components/ui/v2/TableCell';
import { TableContainer } from '@/components/ui/v2/TableContainer';
import { TableRow } from '@/components/ui/v2/TableRow';
import { Text } from '@/components/ui/v2/Text';
import { LogsDetailSheet } from '@/features/orgs/projects/logs/components/LogsDetailSheet';
import {
  highlightLog,
  type SearchRange,
} from '@/features/orgs/projects/logs/components/LogsBody/highlightLog';
import { getServiceStyle } from '@/features/orgs/projects/logs/components/LogsBody/serviceStyle';
import { LogsSearchBar } from '@/features/orgs/projects/logs/components/LogsSearchBar';
import { cn } from '@/lib/utils';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { CellContext } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import { PanelRightOpen } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

export interface LogEntry {
  timestamp: string;
  service: string;
  log: string;
}

export interface LogsData {
  logs: LogEntry[];
}

export interface LogsBodyProps {
  /**
   * The query result
   */
  logsData: LogsData | undefined;
  /**
   * Determines whether or not the query or subscription is loading
   */
  loading: boolean;
  /**
   * Optional error message
   */
  error?: Error;
  tableContainerClasses?: string;
  hideServiceColumn?: boolean;
}

export function LogsBodyCustomMessage({
  children,
}: PropsWithChildren<unknown>) {
  return (
    <TableContainer className="h-full w-full">
      <Table stickyHeader aria-label="sticky table">
        <TableBody>
          <TableRow>
            <TableCell
              className="p-2.5"
              align="left"
              padding="none"
              sx={{ backgroundColor: 'background.paper' }}
            >
              {children}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function DateCell({ getValue }: { getValue: () => string }) {
  return (
    <span className="font-mono text-[0.75rem] leading-[0.875rem]">
      {format(new Date(getValue()), 'yyyy-MM-dd HH:mm:ss')}
    </span>
  );
}

interface SearchHighlightState {
  rangesByRow: Map<number, SearchRange[]>;
}

const SearchHighlightContext = createContext<SearchHighlightState>({
  rangesByRow: new Map(),
});

function TextCell({ row, getValue }: CellContext<LogEntry, string>) {
  const { rangesByRow } = useContext(SearchHighlightContext);
  const ranges = rangesByRow.get(row.index);
  return (
    <span className="font-mono text-[0.75rem] leading-[0.875rem]">
      {highlightLog(getValue(), ranges)}
    </span>
  );
}

type Severity = 'error' | 'warn' | 'info' | 'debug';

const SEVERITY_PATTERNS: RegExp[] = [
  /(?:^|[\s,;{(])(?:level|lvl|severity)=([a-zA-Z]+)/i,
  /["'](?:level|severity)["']\s*:\s*["']([a-zA-Z]+)["']/i,
  /^\[([a-zA-Z]+)\]/,
  /^([A-Z]+):/,
];

function detectSeverity(log: string): Severity | null {
  for (const pattern of SEVERITY_PATTERNS) {
    const match = pattern.exec(log);
    if (!match) continue;
    const word = match[1].toLowerCase();
    if (word === 'error' || word === 'fatal' || word === 'critical') {
      return 'error';
    }
    if (word === 'warn' || word === 'warning') return 'warn';
    if (word === 'info' || word === 'notice' || word === 'log') return 'info';
    if (word === 'debug' || word === 'trace') return 'debug';
  }
  return null;
}

const SEVERITY_TEXT: Record<Severity, string> = {
  error: 'text-red-600 dark:text-red-400',
  warn: 'text-amber-600 dark:text-amber-400',
  info: 'text-green-600 dark:text-green-400',
  debug: 'text-muted-foreground',
};

const SEVERITY_LABEL: Record<Severity, string> = {
  error: 'ERROR',
  warn: 'WARN',
  info: 'INFO',
  debug: 'DEBUG',
};

function ServiceCell({ getValue }: { getValue: () => string }) {
  const service = getValue();
  const { label, className } = getServiceStyle(service);

  return (
    <span
      title={service}
      className={cn(
        'inline-flex max-w-full items-center truncate rounded px-1.5 py-0.5 font-mono text-xs-',
        className,
      )}
    >
      {label}
    </span>
  );
}

const ACTIONS_WIDTH = 90;
const TIMESTAMP_WIDTH = 145;
const SERVICE_WIDTH = 110;
const LOG_MIN_WIDTH = 300;
const LOG_CHAR_WIDTH = 7.5;
const LOG_CELL_PADDING = 16;
const ROW_HEIGHT = 36;

const columns = [
  {
    id: 'timestamp',
    accessorKey: 'timestamp',
    cell: DateCell,
    size: TIMESTAMP_WIDTH,
    header: () => 'Timestamp',
  },
  {
    id: 'service',
    accessorKey: 'service',
    cell: ServiceCell,
    size: SERVICE_WIDTH,
    header: () => 'Service',
  },
  {
    id: 'log',
    accessorKey: 'log',
    cell: TextCell,
    header: () => 'Log',
    minSize: LOG_MIN_WIDTH,
    maxSize: 0,
    size: 0,
  },
];

export default function LogsBody({
  logsData,
  error,
  loading,
  tableContainerClasses,
  hideServiceColumn,
}: LogsBodyProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedEntry, setSelectedEntry] = useState<LogEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [filterMode, setFilterMode] = useState(false);

  const data = useMemo(
    () =>
      logsData?.logs
        ? [...logsData.logs].sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          )
        : [],
    [logsData],
  );

  const tableData = useMemo(() => {
    if (!filterMode || !searchQuery) return data;
    const needle = searchQuery.toLowerCase();
    return data.filter((entry) => entry.log.toLowerCase().includes(needle));
  }, [data, filterMode, searchQuery]);

  const matches = useMemo(() => {
    if (!searchQuery) return [] as { rowIndex: number; start: number; end: number }[];
    const needle = searchQuery.toLowerCase();
    const results: { rowIndex: number; start: number; end: number }[] = [];
    for (let r = 0; r < tableData.length; r += 1) {
      const haystack = tableData[r].log.toLowerCase();
      let from = 0;
      while (from <= haystack.length - needle.length) {
        const found = haystack.indexOf(needle, from);
        if (found === -1) break;
        results.push({
          rowIndex: r,
          start: found,
          end: found + needle.length,
        });
        from = found + needle.length;
      }
    }
    return results;
  }, [tableData, searchQuery]);

  const totalMatches = matches.length;
  const safeCurrent = totalMatches === 0 ? 0 : Math.min(currentMatchIndex, totalMatches - 1);

  const rangesByRow = useMemo(() => {
    const map = new Map<number, SearchRange[]>();
    matches.forEach((match, i) => {
      const list = map.get(match.rowIndex) ?? [];
      list.push({
        start: match.start,
        end: match.end,
        isCurrent: i === safeCurrent,
      });
      map.set(match.rowIndex, list);
    });
    return map;
  }, [matches, safeCurrent]);

  const logColumnWidth = useMemo(() => {
    let longest = 0;
    for (const entry of data) {
      const len = entry.log.length;
      if (len > longest) {
        longest = len;
      }
    }
    const measured = longest * LOG_CHAR_WIDTH + LOG_CELL_PADDING;
    return Math.max(LOG_MIN_WIDTH, measured);
  }, [data]);

  const totalTableWidth =
    ACTIONS_WIDTH +
    TIMESTAMP_WIDTH +
    (hideServiceColumn ? 0 : SERVICE_WIDTH) +
    logColumnWidth;

  const visibleColumns = hideServiceColumn
    ? columns.filter((column) => column.id !== 'service')
    : columns;

  const table = useReactTable({
    data: tableData,
    columns: visibleColumns,
    defaultColumn: {
      size: 0,
    },
    getCoreRowModel: getCoreRowModel(),
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  const toggleSelection = (entry: LogEntry) => {
    setSelectedEntry((current) => (current === entry ? null : entry));
  };

  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    if (totalMatches === 0) return;
    const target = matches[safeCurrent];
    if (!target) return;
    rowVirtualizer.scrollToIndex(target.rowIndex, { align: 'center' });

    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const stickyCover = ACTIONS_WIDTH + TIMESTAMP_WIDTH;
    const SCROLL_BUFFER = 32;

    const adjust = () => {
      const el = scrollEl.querySelector<HTMLElement>('[data-search-current]');
      if (!el) return;
      const containerRect = scrollEl.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const matchLeft = elRect.left - containerRect.left + scrollEl.scrollLeft;
      const matchRight = matchLeft + elRect.width;
      const userVisibleLeft = scrollEl.scrollLeft + stickyCover + SCROLL_BUFFER;
      const userVisibleRight =
        scrollEl.scrollLeft + scrollEl.clientWidth - SCROLL_BUFFER;
      if (matchLeft < userVisibleLeft || matchRight > userVisibleRight) {
        const matchCenter = (matchLeft + matchRight) / 2;
        const visibleAreaWidth = scrollEl.clientWidth - stickyCover;
        const desired = matchCenter - stickyCover - visibleAreaWidth / 2;
        scrollEl.scrollLeft = Math.max(0, desired);
      }
    };

    const raf = requestAnimationFrame(adjust);
    return () => cancelAnimationFrame(raf);
  }, [safeCurrent, totalMatches, matches, rowVirtualizer]);

  useEffect(() => {
    function handler(event: globalThis.KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        const root = scrollRef.current?.parentElement;
        if (!root) return;
        const active = document.activeElement;
        if (active !== document.body && !root.contains(active)) {
          return;
        }
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const goToNextMatch = () => {
    if (totalMatches === 0) return;
    setCurrentMatchIndex((current) => (current + 1) % totalMatches);
  };

  const goToPrevMatch = () => {
    if (totalMatches === 0) return;
    setCurrentMatchIndex(
      (current) => (current - 1 + totalMatches) % totalMatches,
    );
  };

  const clearSearch = () => {
    setSearchQuery('');
    setCurrentMatchIndex(0);
  };


  if (loading && !error) {
    return (
      <TableContainer className="h-full w-full px-4 py-2">
        <ActivityIndicator
          delay={500}
          className="mx-auto"
          label="Loading logs..."
        />
      </TableContainer>
    );
  }

  if (error) {
    return (
      <LogsBodyCustomMessage>
        <Text color="error" className="truncate font-mono text-xs- font-normal">
          {error?.message.includes('the query time range exceeds the limit')
            ? 'The query time range exceeds the limit, please select a shorter range.'
            : error?.message}
        </Text>
      </LogsBodyCustomMessage>
    );
  }

  if (logsData?.logs?.length === 0) {
    return (
      <LogsBodyCustomMessage>
        <Text className="truncate font-mono text-xs- font-normal">
          There are no logs for the selected period.
        </Text>
      </LogsBodyCustomMessage>
    );
  }

  const colgroup = (
    <colgroup>
      <col style={{ width: ACTIONS_WIDTH }} />
      <col style={{ width: TIMESTAMP_WIDTH }} />
      {!hideServiceColumn && <col style={{ width: SERVICE_WIDTH }} />}
      <col />
    </colgroup>
  );

  return (
    <SearchHighlightContext.Provider value={{ rangesByRow }}>
    <div className="flex h-full w-full flex-col overflow-hidden bg-paper">
    <LogsSearchBar
      ref={searchInputRef}
      query={searchQuery}
      onQueryChange={setSearchQuery}
      totalMatches={totalMatches}
      currentMatch={safeCurrent}
      filterMode={filterMode}
      onToggleFilter={() => setFilterMode((current) => !current)}
      onPrev={goToPrevMatch}
      onNext={goToNextMatch}
      onClear={clearSearch}
    />
    <div
      ref={scrollRef}
      className={cn(
        'relative min-h-0 w-full flex-1 overflow-auto bg-paper',
        tableContainerClasses,
      )}
      style={{ scrollbarGutter: 'stable' }}
    >
      <div
        className="sticky top-0 z-10 bg-paper"
        style={{ minWidth: totalTableWidth }}
      >
        <table
          className="w-full border-collapse"
          style={{ tableLayout: 'fixed', minWidth: totalTableWidth }}
        >
          {colgroup}
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                <th
                  scope="col"
                  className="sticky left-0 z-[1] border-b border-divider bg-paper p-2"
                  aria-label="Actions"
                />
                {headerGroup.headers.map((header) => {
                  const stickyLeft =
                    header.column.id === 'timestamp' ? ACTIONS_WIDTH : null;
                  return (
                    <th
                      key={header.id}
                      scope="col"
                      style={
                        stickyLeft !== null
                          ? { left: stickyLeft }
                          : undefined
                      }
                      className={cn(
                        'border-b border-divider p-2 text-left align-middle font-display text-xs- font-semibold',
                        stickyLeft !== null && 'sticky z-[1] bg-paper',
                      )}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
        </table>
      </div>

      <div style={{ height: totalSize, minWidth: totalTableWidth }}>
        <table
          className="w-full"
          style={{
            minWidth: totalTableWidth,
            tableLayout: 'fixed',
            borderCollapse: 'separate',
            borderSpacing: 0,
          }}
        >
          {colgroup}
          <tbody>
            {virtualRows.map((virtualRow, index) => {
              const row = rows[virtualRow.index];
              const isSelected = row.original === selectedEntry;
              const severity = detectSeverity(row.original.log);
              const cellBg = isSelected
                ? 'bg-sky-50 group-hover:bg-sky-100 dark:bg-sky-950 dark:group-hover:bg-sky-900'
                : 'bg-paper group-hover:bg-slate-100 dark:bg-data-cell-bg dark:group-hover:bg-data-cell-bg-hover';
              return (
                <tr
                  key={row.index}
                  data-index={virtualRow.index}
                  className="group"
                  style={{
                    height: ROW_HEIGHT,
                    transform: `translateY(${virtualRow.start - index * ROW_HEIGHT}px)`,
                  }}
                >
                  <td
                    className={cn(
                      'sticky left-0 z-[1] border-b border-divider px-2 align-middle',
                      cellBg,
                    )}
                  >
                    <div className="relative flex items-center justify-between gap-1">
                      <span
                        className={cn(
                          'font-mono text-[11px] font-semibold uppercase tracking-wide tabular-nums w-12',
                          severity
                            ? SEVERITY_TEXT[severity]
                            : 'text-transparent',
                        )}
                      >
                        {severity ? SEVERITY_LABEL[severity] : 'NONE'}
                      </span>
                      <button
                        type="button"
                        aria-label="Open log details"
                        onClick={() => toggleSelection(row.original)}
                        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <PanelRightOpen className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                  {row.getVisibleCells().map((cell) => {
                    const stickyLeft =
                      cell.column.id === 'timestamp' ? ACTIONS_WIDTH : null;
                    return (
                      <td
                        key={cell.id}
                        style={
                          stickyLeft !== null
                            ? { left: stickyLeft }
                            : undefined
                        }
                        className={cn(
                          'overflow-hidden whitespace-nowrap border-b border-divider px-2 align-middle text-[0.75rem] leading-[0.875rem] font-normal tracking-tight',
                          cellBg,
                          stickyLeft !== null && 'sticky z-[1]',
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
    </div>
    <LogsDetailSheet
      entry={selectedEntry}
      onClose={() => setSelectedEntry(null)}
    />
    </SearchHighlightContext.Provider>
  );
}
