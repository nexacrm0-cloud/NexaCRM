'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api-client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, ChevronsUpDown, Building2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Client = { id: string; companyName: string; contactName: string };

export function ClientSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const selected = clients.find((c) => c.id === value);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.get<{ data: Client[] }>('/clients', { search, limit: '20' });
        setClients(res.data);
      } catch {
        setClients([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          {selected ? (
            <div className="flex items-center gap-2 text-left">
              <Building2 className="text-muted-foreground h-4 w-4 shrink-0" />
              <div className="flex flex-col">
                <span className="text-sm font-normal">{selected.companyName}</span>
                <span className="text-muted-foreground text-xs">{selected.contactName}</span>
              </div>
            </div>
          ) : (
            <span className="text-muted-foreground">Buscar cliente...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="p-2">
          <Input
            placeholder="Buscar por nombre o empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="max-h-[240px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          ) : clients.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              {search ? 'Sin resultados' : 'Escribe para buscar'}
            </p>
          ) : (
            clients.map((client) => (
              <button
                key={client.id}
                onClick={() => {
                  onChange(client.id);
                  setOpen(false);
                  setSearch('');
                }}
                className="hover:bg-accent flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors"
              >
                <div className="bg-primary/10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                  <Building2 className="text-primary h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{client.companyName}</p>
                  <p className="text-muted-foreground truncate text-xs">{client.contactName}</p>
                </div>
                {client.id === value && <Check className="text-primary h-4 w-4 shrink-0" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
