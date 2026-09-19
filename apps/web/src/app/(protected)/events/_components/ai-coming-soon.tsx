'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { CalendarCheck2, Sparkles, WandSparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function AiComingSoon() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.aside
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="relative isolate overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-card to-card px-4 py-4 sm:px-5"
      aria-label="Yapay zeka destekli etkinlik asistanı yakında"
    >
      <motion.div
        aria-hidden="true"
        className="absolute -right-10 -top-16 h-44 w-44 rounded-full bg-primary/15 blur-3xl"
        animate={reduceMotion ? undefined : { scale: [1, 1.18, 1], opacity: [0.45, 0.75, 0.45] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative flex items-start gap-3.5">
        <div className="relative mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <WandSparkles className="h-5 w-5" />
          {!reduceMotion && (
            <motion.span
              aria-hidden="true"
              className="absolute -right-1 -top-1"
              animate={{ rotate: [0, 18, 0], scale: [0.85, 1.1, 0.85] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sparkles className="h-3.5 w-3.5 fill-primary text-primary" />
            </motion.span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold sm:text-base">Etkinlik asistanı hazırlanıyor</h2>
            <Badge className="border-primary/30 bg-primary/15 text-foreground hover:bg-primary/15">
              Yakında
            </Badge>
          </div>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground sm:text-sm">
            Program akışı, görev dağılımı ve duyuru metinleri için yapay zeka desteği çok yakında
            burada olacak.
          </p>
        </div>

        <div className="hidden items-center gap-2 self-center text-xs font-medium text-muted-foreground md:flex">
          <CalendarCheck2 className="h-4 w-4 text-primary" />
          Daha hızlı planlama
        </div>
      </div>
    </motion.aside>
  );
}
