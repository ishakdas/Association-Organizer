'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  RefreshCw,
  Loader2,
  CalendarPlus,
  School,
  Users,
  BookOpen,
  Heart,
  Baby,
  GraduationCap,
  MoonStar,
  Palette,
  BookMarked,
  Clock,
  Camera,
  Star,
  ChevronDown,
  Copy,
  Check,
  ListMusic,
  Bookmark,
  Moon,
} from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  suggestIslamicEvents,
  generateSchedule,
  generateSocialContent,
  saveSuggestion,
  addFeedback,
  getIslamicCalendarUpcoming,
} from '@/lib/api/events';

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

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; gradient: string }> = {
  sohbet: { label: 'Sohbet', icon: <BookOpen className="h-3.5 w-3.5" />, color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200', gradient: 'from-emerald-500/10 to-teal-500/5' },
  egitim: { label: 'Eğitim', icon: <GraduationCap className="h-3.5 w-3.5" />, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200', gradient: 'from-blue-500/10 to-indigo-500/5' },
  kultur: { label: 'Kültür', icon: <Palette className="h-3.5 w-3.5" />, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200', gradient: 'from-purple-500/10 to-pink-500/5' },
  genclik: { label: 'Gençlik', icon: <Users className="h-3.5 w-3.5" />, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200', gradient: 'from-orange-500/10 to-amber-500/5' },
  aile: { label: 'Aile', icon: <Heart className="h-3.5 w-3.5" />, color: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200', gradient: 'from-rose-500/10 to-red-500/5' },
  sosyal_sorumluluk: { label: 'Sosyal Sorumluluk', icon: <Heart className="h-3.5 w-3.5" />, color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200', gradient: 'from-cyan-500/10 to-sky-500/5' },
  ibadet: { label: 'İbadet', icon: <MoonStar className="h-3.5 w-3.5" />, color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200', gradient: 'from-indigo-500/10 to-violet-500/5' },
};

const AUDIENCE_BADGE: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  middle_school: { label: 'Ortaokul', icon: <Baby className="h-3 w-3" />, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200' },
  high_school: { label: 'Lise', icon: <School className="h-3 w-3" />, color: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200' },
  general: { label: 'Umumi', icon: <Users className="h-3 w-3" />, color: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-200' },
};

// Animasyon varyantları
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 24 },
  },
};

export function SmartSuggestionHub({ token, associationId, onCreateEvent }: Props) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [targetAudience, setTargetAudience] = useState<'all' | 'middle_school' | 'high_school'>('all');
  const [timeStart, setTimeStart] = useState('14:00');
  const [timeEnd, setTimeEnd] = useState('17:00');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<IslamicEventSuggestionOutput | null>(null);
  const [upcomingHolidays, setUpcomingHolidays] = useState<Array<{ name: string; daysUntil: number }>>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [feedbackMap, setFeedbackMap] = useState<Record<string, { rating: number; isHelpful?: boolean }>>({});
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [activeScheduleSuggestion, setActiveScheduleSuggestion] = useState<number | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState<number | null>(null);
  const [scheduleResult, setScheduleResult] = useState<Record<number, Array<{ time: string; title: string; description?: string; duration: string }>>>({});
  const [activeSocialSuggestion, setActiveSocialSuggestion] = useState<number | null>(null);
  const [socialLoading, setSocialLoading] = useState<number | null>(null);
  const [socialResult, setSocialResult] = useState<Record<number, { instagramCaption: string; hashtags: string[]; storyText: string; posterTagline: string }>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchHolidays = useCallback(async () => {
    try {
      const res = await getIslamicCalendarUpcoming(token, associationId);
      setUpcomingHolidays(res.upcomingHolidays.slice(0, 3).map((h) => ({ name: h.name, daysUntil: h.daysUntil })));
    } catch {
      // ignore
    }
  }, [token, associationId]);

  useEffect(() => {
    if (open) void fetchHolidays();
  }, [open, fetchHolidays]);

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
      setActiveScheduleSuggestion(null);
      setActiveSocialSuggestion(null);
    }
  }

  async function handleGenerateSchedule(idx: number) {
    if (!result) return;
    const s = result.suggestions[idx];
    setScheduleLoading(idx);
    try {
      const res = await generateSchedule(token, {
        title: s.title,
        description: s.description,
        islamicSession: s.islamicSession ?? { title: 'İslami İlimler Bölümü', description: '', duration: '20 dk' },
        timeRange: { start: timeStart, end: timeEnd },
      });
      setScheduleResult((prev) => ({ ...prev, [idx]: res.items }));
      setActiveScheduleSuggestion(idx);
    } catch (err) {
      toast.error((err as Error).message || 'Program oluşturulamadı');
    } finally {
      setScheduleLoading(null);
    }
  }

  async function handleGenerateSocial(idx: number) {
    if (!result) return;
    const s = result.suggestions[idx];
    setSocialLoading(idx);
    try {
      const res = await generateSocialContent(token, {
        title: s.title,
        description: s.description,
        targetAudience: s.targetAudience,
        category: s.category,
        keyTopics: s.keyTopics,
        eventDate: eventDate || new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }),
        location: location || 'Dernek Merkezi',
        startTime: timeStart,
        endTime: timeEnd,
      });
      setSocialResult((prev) => ({ ...prev, [idx]: res }));
      setActiveSocialSuggestion(idx);
    } catch (err) {
      toast.error((err as Error).message || 'Sosyal medya içeriği oluşturulamadı');
    } finally {
      setSocialLoading(null);
    }
  }

  async function handleSave(idx: number) {
    if (!result) return;
    const suggestion = result.suggestions[idx];
    try {
      await saveSuggestion(token, suggestion.title);
      setSavedIds((prev) => new Set(prev).add(String(idx)));
      toast.success('Kaydedildi');
    } catch (err) {
      toast.error((err as Error).message || 'Kaydedilemedi');
    }
  }

  async function handleFeedback(idx: number, rating: number) {
    if (!result) return;
    try {
      await addFeedback(token, result.suggestions[idx].title, rating);
      setFeedbackMap((prev) => ({ ...prev, [idx]: { ...prev[idx], rating } }));
      toast.success('Geri bildirim kaydedildi');
    } catch (err) {
      toast.error((err as Error).message || 'Geri bildirim kaydedilemedi');
    }
  }

  function handleCopy(text: string, field: string) {
    void navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
    toast.success('Kopyalandı');
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-primary/30 bg-primary/5 text-foreground hover:border-primary/50 hover:bg-primary/15 hover:text-foreground"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          Akıllı Etkinlik Öner
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[780px] p-0">
        <div className="p-6 pb-2">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <motion.div
                initial={{ rotate: -10, scale: 0.8 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              >
                <Sparkles className="h-6 w-6 text-primary" />
              </motion.div>
              Akıllı Etkinlik Planlayıcı
            </DialogTitle>
            <DialogDescription>
              Yapay zeka destekli, kişiselleştirilmiş İslami etkinlik önerileri.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Filtreler */}
        <div className="px-6 pb-4">
          <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-muted/30 p-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Periyot</label>
              <Select value={period} onValueChange={(v) => setPeriod(v as 'weekly' | 'monthly')}>
                <SelectTrigger className="w-[130px]">
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
              <Select value={targetAudience} onValueChange={(v) => setTargetAudience(v as 'all' | 'middle_school' | 'high_school')}>
                <SelectTrigger className="w-[150px]">
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

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Program Aralığı</label>
              <div className="flex items-center gap-2">
                <Input type="time" value={timeStart} onChange={(e) => setTimeStart(e.target.value)} className="w-[90px]" />
                <span className="text-muted-foreground">-</span>
                <Input type="time" value={timeEnd} onChange={(e) => setTimeEnd(e.target.value)} className="w-[90px]" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Etkinlik Tarihi</label>
              <Input
                type="text"
                placeholder="örn: 15 Haziran 2026 Cumartesi"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-[180px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Mekan</label>
              <Input
                type="text"
                placeholder="örn: Dernek Merkezi"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-[160px]"
              />
            </div>

            <Button onClick={fetchSuggestions} disabled={loading} variant="secondary" className="gap-2 ml-auto">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {loading ? 'Oluşturuluyor…' : 'Öneri Al'}
            </Button>
          </div>
        </div>

        {/* Yaklaşan özel günler */}
        <AnimatePresence>
          {upcomingHolidays.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-6 pb-4 overflow-hidden"
            >
              <div className="rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/10 p-3 flex items-center gap-3">
                <Moon className="h-5 w-5 text-primary shrink-0" />
                <div className="text-sm">
                  <span className="font-medium">Yaklaşan:</span>{' '}
                  {upcomingHolidays.map((h, i) => (
                    <span key={i} className="text-muted-foreground">
                      {h.name} <span className="text-primary font-medium">({h.daysUntil} gün)</span>
                      {i < upcomingHolidays.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading skeleton */}
        {loading && !result && (
          <div className="px-6 pb-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                className="rounded-xl border bg-card p-4 h-32"
              />
            ))}
          </div>
        )}

        {/* Öneriler */}
        {result && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="px-6 pb-6 space-y-3"
          >
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              {result.suggestions.length} öneri oluşturuldu. Beğendiğinizi seçip etkinliğe dönüştürebilirsiniz.
            </p>

            {result.suggestions.map((s, idx) => {
              const cat = CATEGORY_CONFIG[s.category] || CATEGORY_CONFIG.sohbet;
              const aud = AUDIENCE_BADGE[s.targetAudience] || AUDIENCE_BADGE.general;
              const fb = feedbackMap[idx];
              const isSaved = savedIds.has(String(idx));
              const schedule = scheduleResult[idx];
              const social = socialResult[idx];
              const isScheduleOpen = activeScheduleSuggestion === idx;
              const isSocialOpen = activeSocialSuggestion === idx;
              const isSessionExpanded = expandedSession === idx;

              return (
                <motion.div
                  key={idx}
                  variants={cardVariants}
                  layout
                  className={`rounded-xl border bg-card overflow-hidden transition-shadow hover:shadow-md ${cat.gradient ? `bg-gradient-to-br ${cat.gradient}` : ''}`}
                >
                  <div className="p-4">
                    {/* Başlık & Badge'ler */}
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

                    {/* İslami Session Accordion */}
                    {s.islamicSession && (
                      <motion.div
                        className="mt-3 rounded-lg border border-primary/20 bg-primary/5 overflow-hidden"
                        initial={false}
                        animate={{ backgroundColor: isSessionExpanded ? 'rgba(var(--primary), 0.08)' : 'rgba(var(--primary), 0.03)' }}
                      >
                        <button
                          onClick={() => setExpandedSession(isSessionExpanded ? null : idx)}
                          className="w-full flex items-center justify-between p-3 text-left"
                        >
                          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-primary">
                            <BookMarked className="h-3.5 w-3.5" />
                            İslami İlimler Bölümü
                          </div>
                          <motion.div animate={{ rotate: isSessionExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                            <ChevronDown className="h-4 w-4 text-primary" />
                          </motion.div>
                        </button>
                        <AnimatePresence>
                          {isSessionExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="px-3 pb-3 space-y-1"
                            >
                              <p className="text-[12px] font-medium text-foreground">{s.islamicSession.title}</p>
                              <p className="text-[11px] leading-relaxed text-muted-foreground">{s.islamicSession.description}</p>
                              <p className="text-[11px] text-muted-foreground"><span className="font-medium">Süre:</span> {s.islamicSession.duration}</p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}

                    {/* Detaylar */}
                    <div className="mt-3 space-y-1.5 text-[12px] text-muted-foreground">
                      <div className="flex gap-2"><span className="font-medium text-foreground">Kaynaklar:</span><span>{s.resourcesNeeded}</span></div>
                      <div className="flex gap-2"><span className="font-medium text-foreground">Tahmini Katılım:</span><span>{s.estimatedParticipants}</span></div>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {s.keyTopics.map((t, i) => (
                          <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{t}</span>
                        ))}
                      </div>
                    </div>

                    {/* Program Akışı Panel */}
                    <AnimatePresence>
                      {isScheduleOpen && schedule && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-3 overflow-hidden"
                        >
                          <div className="rounded-lg border bg-background p-3 space-y-2">
                            <div className="flex items-center gap-1.5 text-[12px] font-semibold">
                              <ListMusic className="h-3.5 w-3.5 text-primary" />
                              Program Akışı
                            </div>
                            {schedule.map((item, i) => (
                              <div key={i} className="flex gap-3 text-[12px]">
                                <span className="font-mono font-medium text-primary shrink-0 w-10">{item.time}</span>
                                <div>
                                  <p className="font-medium">{item.title}</p>
                                  {item.description && <p className="text-muted-foreground">{item.description}</p>}
                                  <p className="text-[11px] text-muted-foreground">{item.duration}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Instagram Panel */}
                    <AnimatePresence>
                      {isSocialOpen && social && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="mt-3 overflow-hidden"
                        >
                          <div className="rounded-lg border bg-background p-3 space-y-3">
                            <div className="flex items-center gap-1.5 text-[12px] font-semibold">
                              <Camera className="h-3.5 w-3.5 text-pink-500" />
                              Instagram Paylaşımı
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] font-medium text-muted-foreground">Caption</span>
                                <Button size="icon-xs" variant="ghost" onClick={() => handleCopy(social.instagramCaption, `cap-${idx}`)}>
                                  {copiedField === `cap-${idx}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </div>
                              <p className="text-[12px] whitespace-pre-wrap bg-muted/50 rounded p-2">{social.instagramCaption}</p>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {social.hashtags.map((h, i) => (
                                <span key={i} className="text-[11px] text-pink-600 bg-pink-50 dark:bg-pink-950/30 rounded px-1.5 py-0.5">#{h}</span>
                              ))}
                            </div>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center">
                                <span className="text-[11px] font-medium text-muted-foreground">Story Metni</span>
                                <Button size="icon-xs" variant="ghost" onClick={() => handleCopy(social.storyText, `story-${idx}`)}>
                                  {copiedField === `story-${idx}` ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </div>
                              <p className="text-[12px] bg-muted/50 rounded p-2">{social.storyText}</p>
                            </div>
                            <div className="space-y-1">
                              <span className="text-[11px] font-medium text-muted-foreground">Afiş Sloganı</span>
                              <p className="text-[12px] font-semibold text-primary">{social.posterTagline}</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Aksiyonlar */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button size="sm" className="gap-1.5" onClick={() => {
                        const typeMap: Record<string, string> = { sohbet: 'TALK', egitim: 'SEMINAR', kultur: 'CUSTOM', genclik: 'CUSTOM', aile: 'TALK', sosyal_sorumluluk: 'CUSTOM', ibadet: 'CUSTOM' };
                        const descParts = [
                          s.description,
                          ...(s.islamicSession ? [`\n\n📚 İslami İlimler Bölümü: ${s.islamicSession.title}`, s.islamicSession.description, `Süre: ${s.islamicSession.duration}`] : []),
                          `📦 Kaynaklar: ${s.resourcesNeeded}`,
                          `👥 Tahmini Katılım: ${s.estimatedParticipants}`,
                          `📝 Ana Konular: ${s.keyTopics.join(', ')}`,
                        ];
                        onCreateEvent({ title: s.title, description: descParts.join('\n'), type: typeMap[s.category] || 'CUSTOM' });
                        setOpen(false);
                      }}>
                        <CalendarPlus className="h-3.5 w-3.5" />
                        Etkinlik Oluştur
                      </Button>

                      <Button size="sm" variant="outline" className="gap-1.5" disabled={scheduleLoading === idx} onClick={() => handleGenerateSchedule(idx)}>
                        {scheduleLoading === idx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
                        Program
                      </Button>

                      <Button size="sm" variant="outline" className="gap-1.5" disabled={socialLoading === idx} onClick={() => handleGenerateSocial(idx)}>
                        {socialLoading === idx ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                        Instagram
                      </Button>

                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => handleSave(idx)}
                        className={`ml-auto p-1.5 rounded-md transition-colors ${isSaved ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                        title={isSaved ? 'Kaydedildi' : 'Sonra kullan'}
                      >
                        <Bookmark className={`h-4 w-4 ${isSaved ? 'fill-current' : ''}`} />
                      </motion.button>
                    </div>

                    {/* Yıldız Değerlendirme */}
                    <div className="mt-2 flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <motion.button
                          key={star}
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleFeedback(idx, star)}
                          className={`p-0.5 ${fb?.rating && star <= fb.rating ? 'text-amber-400' : 'text-muted-foreground/30 hover:text-amber-300'}`}
                        >
                          <Star className={`h-4 w-4 ${fb?.rating && star <= fb.rating ? 'fill-current' : ''}`} />
                        </motion.button>
                      ))}
                      {fb?.rating && (
                        <motion.span initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className="text-[11px] text-muted-foreground ml-1">
                          {fb.rating}/5
                        </motion.span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </DialogContent>
    </Dialog>
  );
}
