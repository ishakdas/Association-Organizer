import { buildCreativityPrompt } from './prompt-helpers';

export const GENERATE_RECURRING_PROGRAM_SYSTEM_PROMPT = `
Sen, Türkiye'deki bir İslami derneğin eğitim programı planlayıcısısın.
Görevin: verilen bir etkinlik önerisinden yola çıkarak, haftalık/tekrarlayan bir eğitim programı serisi oluşturmak.

# KATI KURALLAR
1. Çıktı SADECE JSON formatında olmalı.
2. programTitle: Serinin genel başlığı.
3. totalWeeks: Toplam hafta sayısı (verilen).
4. description: Serinin genel amacı ve kapsamı.
5. sessions: Her hafta için ayrı oturum.
   - weekNumber: Hafta numarası (1'den başlar)
   - title: O haftanın başlığı
   - description: O haftada neler yapılacağı
   - theme: O haftanın ana teması
   - keyTopics: 1-5 arası konu başlığı
6. Her hafta bir önceki haftanın üzerine inşa etmeli, mantıklı bir sıra olmalı.
7. Program İslami çerçevede olmalı.
8. Her seferinde FARKLI bir yapı ve ilerleme mantığı kullan. Standart "giriş → gelişme → sonuç" kalıplarının dışına çık.

# ÇIKTı FORMATI
{
  "programTitle": "...",
  "totalWeeks": 6,
  "description": "...",
  "sessions": [
    {
      "weekNumber": 1,
      "title": "...",
      "description": "...",
      "theme": "...",
      "keyTopics": ["...", "..."]
    }
  ]
}
`;

export function buildRecurringProgramUserPrompt(
  title: string,
  description: string,
  targetAudience: string,
  category: string,
  keyTopics: string[],
  weeks: number,
): string {
  const audienceLabel =
    targetAudience === 'middle_school'
      ? 'Ortaokul öğrencileri'
      : targetAudience === 'high_school'
        ? 'Lise öğrencileri'
        : 'Tüm kesimler';

  return `
Etkinlik: ${title}
Açıklama: ${description}
Hedef Kitle: ${audienceLabel}
Kategori: ${category}
Ana Konular: ${keyTopics.join(', ')}

Yukarıdaki etkinlikten yola çıkarak ${weeks} haftalık bir eğitim programı serisi oluştur.
Her hafta bir öncekinin üzerine inşa etmeli ve mantıklı bir sıra izlemeli.

${buildCreativityPrompt('Programın ilerleyişinde farklı pedagojik yaklaşımlar kullan: bazı haftalar tamamen uygulamalı atölye, bazı haftalar müzakere, bazı haftalar proje tabanlı öğrenme. Haftalar arasında geçişlerde “cliffhanger” veya merak uyandıran unsurlar ekle.')}
`.trim();
}
