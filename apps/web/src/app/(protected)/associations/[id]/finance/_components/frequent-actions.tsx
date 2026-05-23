'use client';

import { motion } from 'framer-motion';
import { Zap, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useFrequentCategories } from '../../../_hooks/use-finance';

interface Props {
  associationId: string;
  onQuickAction?: (categoryId: string, type: 'INCOME' | 'EXPENSE') => void;
}

export function FrequentActions({ associationId, onQuickAction }: Props) {
  const { data: categories, isLoading } = useFrequentCategories(associationId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-24 items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!categories || categories.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Zap className="h-4 w-4 text-amber-500" />
          Sık Kullanılanlar
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {categories.map((cat, index) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => onQuickAction?.(cat.id, cat.type)}
                className="h-auto w-full flex-col gap-1 p-2 text-xs"
              >
                <div className="flex items-center gap-1">
                  {cat.type === 'INCOME' ? (
                    <ArrowUpRight className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 text-rose-500" />
                  )}
                  <span className="truncate">{cat.name}</span>
                </div>
                <Badge variant="secondary" className="text-[9px]">
                  {cat.count} işlem
                </Badge>
              </Button>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
