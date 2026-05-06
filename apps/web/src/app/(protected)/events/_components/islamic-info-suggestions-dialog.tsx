'use client';

import { useState } from 'react';
import { BookOpen, Lightbulb, School, Baby } from 'lucide-react';
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
import type { EventTypeValue } from '@ticketbot/shared-validation';

interface Props {
  eventTitle: string;
  eventType: EventTypeValue;
}

type Level = 'middle_school' | 'high_school';

const SUGGESTIONS: Record<EventTypeValue, Record<Level, string[]>> = {
  TALK: {
    middle_school: [
      'Hz. Muhammed (sav)\'in çocukluk ve gençlik yıllarından seçme hikayeler',
      'Günlük hayatta okunabilecek kısa dualar ve anlamları (besmele, hamdele, tesbih)',
      'İslam\'da komşu hakları ve güzel ahlak örnekleri',
      'Kur\'an\'dan kısa ve anlaşılır sureler (Fatiha, İhlas, Felek, Nas) ve Türkçe mealleri',
      'Namazın önemi ve abdest almanın adabı',
      'Ana-baba hakkı ve aile içi sevgi',
    ],
    high_school: [
      'Hz. Muhammed (sav)\'in hayatından stratejik kararlar ve liderlik dersleri (Siyer)',
      'Kur\'an\'da ahlaki ilkeler: adalet, dürüstlük, sabır ve tevekkül',
      'İslam\'da irşad ve tebliğ metodları: hikmet ve güzel söz',
      'Günümüz gençliğinin karşılaştığı sorunlara İslami perspektiften yaklaşım',
      'İslam düşünce tarihinden seçme mütefekkirler ve eserleri',
      'Kur\'an\'da insan-çevre ilişkisi ve sorumluluk bilinci',
    ],
  },
  CONFERENCE: {
    middle_school: [
      'İslam bilim tarihinden çocuklara uygun mucitler ve icatlar (El-Cezeri, İbni Sina)',
      'Ramazan ve oruç: disiplin, sabır ve paylaşma kültürü',
      'Peygamberimizin hayvan sevgisi ve doğaya saygı örnekleri',
      'İslam\'da temizlik ve hijyen kuralları',
      'Müslüman çocukların tarihteki başarı hikayeleri',
    ],
    high_school: [
      'İslam\'ın bilimsel yönteme katkıları: gözlem, deney ve rasyonalite',
      'Müslüman gençlik ve kimlik: globalleşme çağında İslami duruş',
      'İslam\'da insan hakları ve hukuk anlayışı: adalet, eşitlik, hürriyet',
      'İslam sanat ve mimarisinden örnekler: estetik ve mana bütünlüğü',
      'İslam\'ın çevre etiğine bakış: israfın yasaklanması ve sürdürülebilirlik',
      'Tarihteki İslam medeniyetlerinin yükseliş ve çöküş nedenleri üzerine düşünce',
    ],
  },
  SEMINAR: {
    middle_school: [
      'Kur\'an-ı Kerim\'i güzel okuma (Tecvid) temel kuralları',
      'Peygamberimizin günlük hayatı ve sünnetleri (sabah duası, yemek adabı)',
      'İslam\'da önemli gün ve geceler: Kadir Gecesi, Berat Gecesi, Mevlid Kandili',
      'Temel İslam bilgileri: 5 şart, 6 iman esası ve günlük ibadetler',
      'Dua ve zikir saati: kalp huzuru için pratik egzersizler',
    ],
    high_school: [
      'Kur\'an tefsirine giriş: nüzul sebepleri ve bağlamsal okuma',
      'Hadis ilmine giriş: isnad, metin ve sahihlik kavramları',
      'Fıkhın temel kaynakları ve güncel meselelere uygulanması',
      'İslam\'da akıl-nakil ilişkisi ve müspet bilimlerle uyumu',
      'Tasavvuf ve ahlak terbiyesi: nefs muhasebesi ve irade eğitimi',
      'İslam hukukunda özgürlük, sorumluluk ve toplumsal düzen',
    ],
  },
  IFTAR: {
    middle_school: [
      'Orucun manası: Allah\'a yakınlaşma, sabır ve şükür',
      'Ramazan ayının faziletleri ve orucun sağlık üzerindeki etkileri',
      'İftar ve sahur duası: örnek dualar ve anlamları',
      'Ramazan\'da sadaka ve yardımlaşma: zekatın önemi',
      'Teravih namazı ve Ramazan gecelerinin değeri',
    ],
    high_school: [
      'Orucun felsefi ve manevi boyutu: nefs terbiyesi ve öz disiplin',
      'Ramazan\'ın toplumsal birlikteliğe katkısı: sınıfsal farkların aşılması',
      'İslam\'da yeme-içme adabı ve israfın yasaklanması',
      'Zekat ve infakın ekonomik ve sosyal adalet bağlamındaki rolü',
      'Kur\'an\'da oruç ayeti (Bakara 183-185) tefsiri ve bağlamı',
    ],
  },
  KANDIL: {
    middle_school: [
      'Kandil gecelerinin anlamı ve önemi: Regaib, Miraç, Berat, Mevlid, Kadir',
      'Peygamberimizin doğumu ve çocuklara örnek olacak davranışları (Mevlid Kandili)',
      'Berat Gecesi: bağışlanma, tövbe ve yeni başlangıçlar',
      'Kadir Gecesi: Kur\'an\'ın inişi ve bin aydan hayırlı gece',
      'Kandil gecelerinde okunabilecek dualar ve zikirler',
    ],
    high_school: [
      'Kandil gecelerinin tarihsel ve kültürel oluşumu: İslam geleneğinde kutlama',
      'Miraç hadisesi: manevi yükseliş ve ibadetlerin farz kılındığı gece',
      'Berat Gecesi\'nin tasavvufi ve ahlaki boyutu: nefs muhasebesi ve arınma',
      'Kadir Gecesi\'nin Kur\'an merkezli önemi ve gece ibadetlerinin fazileti',
      'Mevlid Kandili\'nde Hz. Muhammed (sav)\'in ümmetine mesajları ve liderlik vasfı',
    ],
  },
  MEETING: {
    middle_school: [
      'İstişare kültürü: karar alırken danışmanın önemi (Kur\'an\'dan örnekler)',
      'Cami ve dernek hayatında çocukların görev ve sorumlulukları',
      'Birlik ve beraberlik: İslam\'da kardeşlik bilinci',
      'Güzel söz ve tebessüm: topluluk içinde iletişim adabı',
      'İslam\'da emanet bilinci: görevlerin yerine getirilmesi',
    ],
    high_school: [
      'İslam\'da şura ve demokrasi anlayışı: toplumsal katılım ve danışma',
      'Gençlik örgütlenmesi ve liderlik: sahabelerden örnekler',
      'Cami ve dernek yönetiminde şeffaflık, hesap verebilirlik ve adalet',
      'İslam\'da toplumsal huzurun sağlanması: adalet, merhamet ve hoşgörü',
      'Müslüman gençlerin sivil toplum çalışmaları ve gönüllülük bilinci',
    ],
  },
  CUSTOM: {
    middle_school: [
      'Günlük dualar: sabah, akşam, yemek, uyku duaları ve anlamları',
      'İslam\'da önemli şahsiyetler: çocuklara uygun kısa hayat hikayeleri',
      'Kur\'an\'dan kısa sureler ve ezberlenmesi kolay ayetler',
      'İslam\'da komşuluk, arkadaşlık ve paylaşma değerleri',
      'Namaz ve abdest: adım adım öğrenme rehberi',
    ],
    high_school: [
      'İslam\'da ahlak felsefesi: erdemler etiği ve karakter eğitimi',
      'Kur\'an\'da insanın yaratılış gayesi ve sorumlulukları',
      'Modern dünya sorunlarına İslami çözüm önerileri: ahlaki çöküş, tüketim kültürü',
      'İslam düşünce geleneğinde özgürlük, eşitlik ve kardeşlik',
      'Dijital çağda Müslüman gençlik: sosyal medya etiği ve bilinçli kullanım',
      'İslam\'da ilim ve eğitim anlayışı: öğrenmenin ömür boyu sürekliliği',
    ],
  },
};

export function IslamicInfoSuggestionsDialog({ eventTitle, eventType }: Props) {
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<Level>('middle_school');

  const suggestions = SUGGESTIONS[eventType]?.[level] ?? SUGGESTIONS.CUSTOM[level];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Lightbulb className="h-3.5 w-3.5" />
          İslami Bilgi Önerileri
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-5 w-5 text-primary" />
            İslami Bilgi Önerileri
          </DialogTitle>
          <DialogDescription>
            “{eventTitle}” etkinliği sırasında sunulabilecek İslami bilgiler.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            variant={level === 'middle_school' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLevel('middle_school')}
            className="gap-1.5"
          >
            <Baby className="h-3.5 w-3.5" />
            Ortaokul
          </Button>
          <Button
            variant={level === 'high_school' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setLevel('high_school')}
            className="gap-1.5"
          >
            <School className="h-3.5 w-3.5" />
            Lise
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {level === 'middle_school' ? 'Ortaokul' : 'Lise'} seviyesi öneriler
            </span>
            <Badge variant="secondary" className="text-[11px]">
              {suggestions.length} öneri
            </Badge>
          </div>
          <ul className="space-y-2">
            {suggestions.map((item, idx) => (
              <li
                key={idx}
                className="rounded-md border border-border bg-card p-3 text-[13px] leading-relaxed text-foreground"
              >
                <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                  {idx + 1}
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
