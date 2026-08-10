'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Building2, Target, CheckSquare, FileText } from 'lucide-react';

type SearchResult = {
  id: string;
  entityType: string;
  entityId: string;
  title: string;
  content: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

const entityIcons: Record<string, typeof Building2> = {
  client: Building2,
  deal: Target,
  task: CheckSquare,
  quote: FileText,
};

const entityRoutes: Record<string, string> = {
  client: '/clients/',
  deal: '/pipeline',
  task: '/tasks',
  quote: '/quotes',
};

export function GlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get<{ items: SearchResult[]; total: number }>('/search', {
          q: query,
          limit: '8',
        });
        setResults(res.items || []);
        setOpen(true);
        setSelectedIndex(-1);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const navigate = (result: SearchResult) => {
    const base = entityRoutes[result.entityType] || '/';
    const path = result.entityType === 'deal' ? base : `${base}${result.entityId}`;
    setOpen(false);
    setQuery('');
    router.push(path);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      const result = results[selectedIndex];
      if (result) navigate(result);
    }
  };

  return (
    <div className="relative w-full max-w-sm">
      <Search className="text-muted-foreground absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        placeholder="Buscar... (/)"
        className="h-9 pl-8 text-sm"
      />
      {loading && (
        <Loader2 className="text-muted-foreground absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin" />
      )}
      {open && (
        <div className="border-border bg-popover absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border shadow-lg">
          {results.length === 0 && !loading ? (
            <p className="text-muted-foreground p-4 text-center text-sm">Sin resultados</p>
          ) : (
            <div className="max-h-[320px] overflow-y-auto py-1">
              {results.map((result, index) => {
                const Icon = entityIcons[result.entityType] || Search;
                return (
                  <button
                    key={result.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      navigate(result);
                    }}
                    className={`hover:bg-accent flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${
                      index === selectedIndex ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                      <Icon className="text-primary h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{result.title}</p>
                      <p className="text-muted-foreground truncate text-xs">{result.content}</p>
                    </div>
                    <span className="text-muted-foreground shrink-0 text-xs capitalize">
                      {result.entityType}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
