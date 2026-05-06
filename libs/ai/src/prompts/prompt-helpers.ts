// Prompt creativity helpers — random perspective & tone injection
// to break repetitive AI output patterns.

export const PERSPECTIVES = [
  'Samimi ve heyecanlı bir gençlik lideri gözünden yaz. Enerjik, motive edici bir dil kullan.',
  'Bir eğitimci/öğretmen bakış açısıyla yaz. Akademik ama uygulanabilir, kaynakça vermeden derinlemesine.',
  'Bir hikaye anlatıcısı üslubuyla yaz. Her etkinlik bir “yolculuk” hissi versin, duygusal bağ kurulsun.',
  'Bir aile babasının/annesinin gözünden yaz. Sıcak, kapsayıcı, aile değerlerini ön planda tut.',
  'Bir organizasyon uzmanı gibi yaz. Pratik, detaylı, kaynak yönetimi odaklı.',
  'Bir sanatçı/estetik bakış açısıyla yaz. Estetik, yaratıcı, ilham verici detaylar ekle.',
  'Bir gönüllü koordinatörü gibi yaz. İcra odaklı, maliyet-efektif, hızlı organize edilebilir.',
  'Bir tarihçi/siyer uzmanı gibi yaz. İslami tarihî referansları modern yaşama bağla.',
] as const;

export const CREATIVITY_CONSTRAINTS = [
  'Önceki önerilerde hiç denenmemiş formatlar ve konseptler kullan.',
  'Standart “bowling + sohbet” veya “piknik + sohbet” gibi klişe kalıpların dışına çık.',
  'En az bir öneri “deneysel/kreatif” kategoride olsun: interaktif, teknoloji entegreli veya mekân bazlı farklı bir deneyim sun.',
  'Etkinlikler arasında tema bütünlüğü kur: haftanın/ayın ruhuna uygun bir “ana tema” belirle ve tüm öneriler ona hizmet etsin.',
  'Her öneride en az bir “wow faktörü” olsun: katılımcının “bunu daha önce hiç görmemiştim” demesini sağlayacak bir detay.',
  'Etkinlik formatlarını çeşitlendir: bazıları tamamen iç mekân, bazıları açık hava, bazıları hibrit (online + yüz yüze).',
] as const;

export function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickRandomSubset<T>(arr: readonly T[], count: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, arr.length));
}

export function buildCreativityPrompt(extra?: string): string {
  const perspective = pickRandom(PERSPECTIVES);
  const constraints = pickRandomSubset(CREATIVITY_CONSTRAINTS, 2).join('\n');
  return `
# YARATICILIK TALIMATLARI
${perspective}
${constraints}
${extra ? extra : ''}
`.trim();
}
