'use client';

import { useState } from 'react';
import { Sparkles, RefreshCw, Loader2, CalendarPlus, School, Users, BookOpen, Heart, Baby, GraduationCap, MoonStar, Palette, BookMarked } from 'lucide-react';
import type { IslamicEventSuggestionOutput } from '@ticketbot/shared-validation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { suggestIslamicEvents } from '@/lib/api/events';
import { toast } from 'sonner';

interface Props {
  token: string;
  associationId: string;
  onCreateEvent: (prefill: { title: string; description: string; type: string }) => void;
}

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'Tümü' },
  { value: 'middle_school', label: 'Ortaokul' },
  { value: 'high_school', label: 'Lise' },
] as const;

const PERIOD_OPTIONS = [
  { value: 'weekly', label: 'Haftalık' },
  { value: 'monthly', label: 'Aylık' },
] as const;

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  sohbet: { label: 'Sohbet', icon: <BookOpen className="h-3.5 w-3.5" />, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200' },
  egitim: { label: 'Eğitim', icon: <GraduationCap className="h-3.5 w-3.5" />, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' },
  kultur: { label: 'Kültür', icon: <Palette className="h-3.5 w-3.5" />, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200' },
  genclik: { label: 'Gençlik', icon: <Users className="h-3.5 w-3.5" />, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200' },
  aile: { label: 'Aile', icon: <Heart className="h-3.5 w-3.5" />, color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200' },
  sosyal_sorumluluk: { label: 'Sosyal Sorumluluk', icon: <Heart className="h-3.5 w-3.5" />, color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200' },
  ibadet: { label: 'İbadet', icon: <MoonStar className="h-3.5 w-3.5" />, color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200' },
};

const AUDIENCE_BADGE: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  middle_school: { label: 'Ortaokul', icon: <Baby className="h-3 w-3" />, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' },
  high_school: { label: 'Lise', icon: <School className="h-3 w-3" />, color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200' },
  general: { label: 'Umumi', icon: <Users className="h-3 w-3" />, color: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-200' },
};

export function SuggestIslamicEventsDialog({ token, associationId, onCreateEvent }: Props) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [targetAudience, setTargetAudience] = useState<'all' | 'middle_school' | 'high_school'>('all');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IslamicEventSuggestionOutput | null>(null);

  async function fetchSuggestions() {
    setLoading(true);
    try {
      const res = await suggestIslamicEvents(token, associationId, { period, targetAudience });
      setResult(res);
    } catch (err) {
      toast.error((err as Error).message || 'Öneriler alınamadı');
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next && !result && !loading) {
      void fetchSuggestions();
    }
    if (!next) {
      setResult(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          İslami Etkinlik Öner
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            İslami Etkinlik Önerileri
          </DialogTitle>
          <DialogDescription>
            Yapay zeka destekli haftalık/aylık İslami çalışma önerileri.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Periyot</label>
            <Select
              value={period}
              onValueChange={(v) => setPeriod(v as 'weekly' | 'monthly')}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Hedef Kitle</label>
            <Select
              value={targetAudience}
              onValueChange={(v) => setTargetAudience(v as 'all' | 'middle_school' | 'high_school')}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={fetchSuggestions}
            disabled={loading}
            variant="secondary"
            className="gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {loading ? 'Oluşturuluyor…' : 'Yenile'}
          </Button>
        </div>

        {loading && !result && (
          <div className="flex flex-col items-center gap-3 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">İslami etkinlik önerileri oluşturuluyor…</p>
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {result.suggestions.length} öneri oluşturuldu. Beğendiğinizi seçip etkinliğe dönüştürebilirsiniz.
            </p>
            {result.suggestions.map((s, idx) => {
              const cat = CATEGORY_CONFIG[s.category] || CATEGORY_CONFIG.sohbet;
              const aud = AUDIENCE_BADGE[s.targetAudience] || AUDIENCE_BADGE.general;
              return (
                <div
                  key={idx}
                  className="rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/30"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold leading-snug">{s.title}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className={`gap-1 text-[11px] ${cat.color}`}>
                        {cat.icon}
                        {cat.label}
                      </Badge>
                      <Badge variant="secondary" className={`gap-1 text-[11px] ${aud.color}`}>
                        {aud.icon}
                        {aud.label}
                      </Badge>
                    </div>
                  </div>

                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                    {s.description}
                  </p>

                  {/* Islamic Session Section */}
                  {s.islamicSession && (
                    <div className="mt-3 rounded-md border border-primary/20 bg-primary/5 p-3">
                      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-primary">
                        <BookMarked className="h-3.5 w-3.5" />
                        İslami İlimler Bölümü
                      </div>
                      <div className="mt-1.5 space-y-1">
                        <p className="text-[12px] font-medium text-foreground">
                          {s.islamicSession.title}
                        </p>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {s.islamicSession.description}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          <span className="font-medium">Süre:</span> {s.islamicSession.duration}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 space-y-1.5 text-[12px] text-muted-foreground">
                    <div className="flex gap-2">
                      <span className="font-medium text-foreground">Kaynaklar:</span>
                      <span>{s.resourcesNeeded}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="font-medium text-foreground">Tahmini Katılım:</span>
                      <span>{s.estimatedParticipants}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {s.keyTopics.map((t, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-muted px-2 py-0.5 text-[11px]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        const typeMap: Record<string, string> = {
                          sohbet: 'TALK',
                          egitim: 'SEMINAR',
                          kultur: 'CUSTOM',
                          genclik: 'CUSTOM',
                          aile: 'TALK',
                          sosyal_sorumluluk: 'CUSTOM',
                          ibadet: 'CUSTOM',
                        };
                        const descParts = [
                          s.description,
                          ...(s.islamicSession
                            ? [
                                `\n\n📚 İslami İlimler Bölümü: ${s.islamicSession.title}`,
                                s.islamicSession.description,
                                `Süre: ${s.islamicSession.duration}`,
                              ]
                            : []),
                          `📦 Kaynaklar: ${s.resourcesNeeded}`,
                          `👥 Tahmini Katılım: ${s.estimatedParticipants}`,
                          `📝 Ana Konular: ${s.keyTopics.join(', ')}`,
                        ];
                        onCreateEvent({
                          title: s.title,
                          description: descParts.join('\n'),
                          type: typeMap[s.category] || 'CUSTOM',
                        });
                        setOpen(false);
                      }}
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                      Etkinlik Oluştur
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
