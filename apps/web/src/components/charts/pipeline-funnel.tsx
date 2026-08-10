'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Filter } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';

type PipelineFunnelData = {
  data: Array<{ stage: string; deals: number; value: number; color: string }>;
};

const INK_BAR = ['#C8C0A8', '#A89A6F', '#8A783F', '#67522A'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-receipt border-ink/22 shadow-recibo border px-3 py-2">
      <p className="eyebrow text-ink-3 mb-1">{label}</p>
      <p className="text-sm">
        <span className="numeral text-naranja">{payload[0].payload.deals}</span>
        <span className="text-ink-3"> oportunidades</span>
      </p>
      <p className="text-ink-2 text-sm">
        <span className="numeral">${Number(payload[0].payload.value).toLocaleString('es-AR')}</span>
      </p>
    </div>
  );
};

export function PipelineFunnel() {
  const { data, isLoading } = useQuery<PipelineFunnelData>({
    queryKey: ['pipeline-funnel'],
    queryFn: () => api.get('/pipeline/funnel'),
  });

  if (isLoading) {
    return (
      <Card>
        <div className="eyebrow flex items-center justify-between">
          <span>02 · Embudo</span>
          <Filter className="text-ink-3 h-3.5 w-3.5" strokeWidth={1.5} />
        </div>
        <div className="px-5 pb-3 pt-0">
          <CardTitle>Embudo comercial</CardTitle>
        </div>
        <div className="px-5 pb-5">
          <Skeleton className="h-64 w-full" />
        </div>
      </Card>
    );
  }

  const chartData = data?.data ?? [];

  return (
    <Card>
      <div className="eyebrow flex items-center justify-between">
        <span>02 · Embudo</span>
        <Filter className="text-ink-3 h-3.5 w-3.5" strokeWidth={1.5} />
      </div>
      <div className="px-5 pb-3 pt-0">
        <CardTitle>Embudo comercial</CardTitle>
      </div>
      <div className="px-5 pb-5">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <XAxis
                type="number"
                tick={{ fill: 'hsl(var(--ink-3))', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                dataKey="stage"
                type="category"
                tick={{ fill: 'hsl(var(--ink-2))', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={92}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--ink) / 0.04)' }} />
              <Bar dataKey="deals" radius={[0, 0, 0, 0]} barSize={20}>
                {chartData.map((_, index) => (
                  <Cell key={index} fill={INK_BAR[index % INK_BAR.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
