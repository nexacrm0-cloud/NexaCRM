'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

type SalesTrendPoint = { month: string; sales: number };

// The endpoint may answer with the plain array or wrapped in `{ data: [...] }`
// (both shapes are in use across the API). The chart accepts either one so a
// cosmetic envelope change can never blank the graph.
type SalesTrendData = SalesTrendPoint[] | { data: SalesTrendPoint[] };

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-receipt border-ink/22 shadow-recibo border px-3 py-2">
      <p className="eyebrow text-ink-3 mb-1">{label}</p>
      <p className="numeral text-naranja text-[18px]">
        ${Number(payload[0].value).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
      </p>
    </div>
  );
};

export function SalesTrendChart() {
  const { data, isLoading } = useQuery<SalesTrendData>({
    queryKey: ['sales-trend'],
    queryFn: () => api.get('/dashboard/sales-trend'),
  });

  if (isLoading) {
    return (
      <Card>
        <div className="eyebrow flex items-center justify-between">
          <span>01 · Tendencia</span>
          <TrendingUp className="text-ink-3 h-3.5 w-3.5" strokeWidth={1.5} />
        </div>
        <CardHeader className="pb-2 pt-0">
          <CardTitle>Tendencia de ventas</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const raw = data as SalesTrendData | undefined;
  const chartData: SalesTrendPoint[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
  const maxSales = Math.max(...chartData.map((d) => d.sales), 1);

  return (
    <Card>
      <div className="eyebrow flex items-center justify-between">
        <span>01 · Tendencia</span>
        <TrendingUp className="text-ink-3 h-3.5 w-3.5" strokeWidth={1.5} />
      </div>
      <CardHeader className="pb-2 pt-0">
        <CardTitle>Tendencia de ventas — últimos 6 meses</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--naranja))" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="hsl(var(--naranja))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--ink) / 0.10)" strokeDasharray="0" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fill: 'hsl(var(--ink-3))', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--ink) / 0.18)' }}
              />
              <YAxis
                tick={{ fill: 'hsl(var(--ink-3))', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                domain={[0, maxSales * 1.2]}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ stroke: 'hsl(var(--ink) / 0.30)', strokeDasharray: '2 4' }}
              />
              <Area
                type="linear"
                dataKey="sales"
                stroke="hsl(var(--naranja))"
                strokeWidth={1.5}
                fill="url(#salesGradient)"
                dot={{ fill: 'hsl(var(--naranja))', r: 3, strokeWidth: 0 }}
                activeDot={{
                  fill: 'hsl(var(--naranja))',
                  r: 5,
                  stroke: 'hsl(var(--paper))',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
