'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { PieChart as PieChartIcon } from 'lucide-react';

interface CategoryData {
  name: string;
  value: number;
  type: 'INCOME' | 'EXPENSE';
}

interface Props {
  data: CategoryData[];
  type: 'INCOME' | 'EXPENSE';
}

const COLORS = {
  INCOME: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#059669', '#047857'],
  EXPENSE: ['#f43f5e', '#fb7185', '#fda4af', '#fecdd3', '#e11d48', '#be123c'],
};

function kurusToTl(kurus: number): string {
  return `${(kurus / 100).toFixed(2)} TL`;
}

export function CategoryChart({ data, type }: Props) {
  const filtered = data.filter((d) => d.type === type && d.value > 0);

  if (filtered.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <PieChartIcon className="h-4 w-4 text-primary" />
            {type === 'INCOME' ? 'Gelir' : 'Gider'} Kategori Dağılımı
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-64 items-center justify-center text-sm text-muted-foreground">
          Veri bulunmuyor
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <PieChartIcon className="h-4 w-4 text-primary" />
          {type === 'INCOME' ? 'Gelir' : 'Gider'} Kategori Dağılımı
        </CardTitle>
      </CardHeader>
      <CardContent>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={filtered}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
                nameKey="name"
              >
                {filtered.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[type][index % COLORS[type].length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => kurusToTl(Number(value))}
                contentStyle={{
                  borderRadius: '8px',
                  border: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--card))',
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconType="circle"
                iconSize={8}
                formatter={(value: string) => (
                  <span className="text-xs">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      </CardContent>
    </Card>
  );
}
