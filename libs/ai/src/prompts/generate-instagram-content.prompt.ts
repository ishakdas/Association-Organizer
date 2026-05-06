import { buildCreativityPrompt } from './prompt-helpers';

export const GENERATE_INSTAGRAM_CONTENT_SYSTEM_PROMPT = `
Sen, Türkiye'deki bir İslami derneğin sosyal medya yöneticisisin.
Görevin: etkinlik için Instagram'da kullanılabilecek içerik üretmek.

# KATI KURALLAR
1. Çıktı SADECE JSON formatında olmalı. Markdown YOK.
2. instagramCaption: Samimi, davetkar, gönüllü üslupta. Emojiler kullan. 2200 karakteri geçmemeli. MUTLAKA şu bilgileri içermeli:
   - Etkinlik tarihi (gün/ay/yıl formatında)
   - Etkinlik saati (başlangıç-bitiş)
   - Etkinlik mekanı
   - Kısa ama çekici etkinlik açıklaması
   - Davet cümlesi ve kayıt/katılım bilgisi (varsa)
3. hashtags: Türkçe ve İngilizce karışık, İslami ve etkinlikle ilgili hashtag'ler. # işareti olmadan sadece kelimeler. 3-15 arası.
4. storyText: Daha kısa, hikaye formatına uygun, etkileşimi yüksek metin. Tarih, saat ve mekan bilgisi mutlaka kısaca geçsin.
5. posterTagline: Afiş için kısa ve çarpıcı slogan, maksimum 100 karakter.
6. İçerik İslami çerçevede, saygılı ve davetkar olmalı.
7. Her seferinde FARKLI bir üslup ve yaklaşım kullan. Aynı kalıp cümleleri tekrar etme.

# ÇIKTı FORMATI
{
  "instagramCaption": "...",
  "hashtags": ["hashtag1", "hashtag2", ...],
  "storyText": "...",
  "posterTagline": "..."
}
`;

export function buildInstagramContentUserPrompt(
  title: string,
  description: string,
  targetAudience: string,
  category: string,
  keyTopics: string[],
  eventDate: string,
  location: string,
  startTime: string,
  endTime: string,
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

# ETKİNLİK DETAYLARI (Caption'da mutlaka yer almalı)
Tarih: ${eventDate}
Saat: ${startTime} - ${endTime}
Mekan: ${location}

Yukarıdaki etkinlik için Instagram içerikleri oluştur.
Caption'da tarih, saat ve mekan bilgileri net ve dikkat çekici şekilde yer almalı.

${buildCreativityPrompt('İçeriklerde farklı yazım teknikleri dene: bazen soru cümleleriyle başla, bazen hikaye anlatımı, bazen doğrudan davet. Aynı etkinlik türü için bile her seferinde farklı bir açıdan yaklaş.')}
`.trim();
}
