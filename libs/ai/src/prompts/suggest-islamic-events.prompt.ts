import { buildCreativityPrompt, pickRandomSubset } from './prompt-helpers';

// ---------------------------------------------------------------------------
// Few-shot example pool — injected randomly so the model never memorises a
// fixed template set.
// ---------------------------------------------------------------------------

const FEW_SHOT_EXAMPLES = [
`## Örnek: Lise - Eğlence + İslami Ders
{
  "title": "Gençler Bowling Turnuvası: Yarış ve Kardeşlik",
  "description": "Lise öğrencileri için bowling turnuvası. Takımlar halinde yarışarak hem eğlenecek hem de kardeşlik bağlarını güçlendirecekler. Turnuva sonunda ödül töreni ve pizza ikramı yapılacak.",
  "targetAudience": "high_school",
  "category": "genclik",
  "keyTopics": ["Spor ve İslam", "Kardeşlik", "Centilmenlik", "Takım çalışması"],
  "resourcesNeeded": "Bowling salonu rezervasyonu, ödüller, pizza, içecek, taşıma aracı",
  "estimatedParticipants": "15-20 lise öğrencisi",
  "islamicSession": {
    "title": "Sahabe Gençleri ve Spor Ahlakı",
    "description": "Bowling öncesi 20 dakikalık sohbet. Hz. Ali ve diğer genç sahabilerin güreş ve at yarışındaki örnek davranışları anlatılacak. Sporda centilmenlik, yenilgiyi kabullenme ve kardeşlik konuları işlenecek.",
    "duration": "20 dk"
  }
}`,

`## Örnek: Ortaokul - Eğlence + İslami Ders
{
  "title": "Küçük Müminler Sinema Günü: Peygamberlerin Hayatı",
  "description": "Ortaokul öğrencileri için İslami içerikli animasyon film gösterimi. 'Hz. Yusuf' veya benzeri bir animasyon izlenecek, ardından patlamış mısır ve meyve suyu ikramı yapılacak. Film sonunda çocuklar duygularını ve öğrendiklerini paylaşacak.",
  "targetAudience": "middle_school",
  "category": "kultur",
  "keyTopics": ["Hz. Yusuf'un hayatı", "Sabır ve tevekkül", "Aile sevgisi", "İslami animasyon"],
  "resourcesNeeded": "Projeksiyon veya sinema salonu, patlamış mısır, meyve suyu, battaniye, İslami animasyon filmi",
  "estimatedParticipants": "15-25 çocuk",
  "islamicSession": {
    "title": "Sabır Dersi: Hz. Yusuf'un Kuyudan Saraya Yolculuğu",
    "description": "Film öncesi 15 dakikalık etkileşimli sohbet. Çocuklara 'sabır nedir?' sorusu sorulacak, Hz. Yusuf'un kuyuda bekleyişi ve sonundaki muzafferiyeti hikaye edilecek. Günlük hayatta sabır örnekleri tartışılacak.",
    "duration": "15 dk"
  }
}`,

`## Örnek: Lise - Eğlence + İslami Ders
{
  "title": "Gençler Bilardo Turnuvası: Strateji ve Tevekkül",
  "description": "Lise öğrencileri için bilardo turnuvası. Strateji, konsantrasyon ve soğukkanlılık gerektiren bu oyunda gençler hem eğlenecek hem de rekabetçi ruhlarını kontrol altında tutmayı öğrenecekler. Turnuva sonunda ödül töreni yapılacak.",
  "targetAudience": "high_school",
  "category": "genclik",
  "keyTopics": ["Strateji ve planlama", "Konsantrasyon", "Centilmenlik", "Rekabet ahlakı"],
  "resourcesNeeded": "Bilardo salonu rezervasyonu, ödüller, çay ikramı",
  "estimatedParticipants": "8-16 lise öğrencisi",
  "islamicSession": {
    "title": "Tevekkül ve Çaba: Strateji Yapan Sahabe",
    "description": "Turnuva öncesi 15 dakikalık sohbet. Bedir Savaşı öncesi Hz. Peygamber'in strateji toplantısı ve tevekkül örneği anlatılacak. 'Çalış tevekkül et' hadisi üzerinde durulacak.",
    "duration": "15 dk"
  }
}`,

`## Örnek: Ortaokul - Eğlence + İslami Ders
{
  "title": "Çocuklar Tiyatro Günü: Dürüstlük Tiyatrosu",
  "description": "Ortaokul öğrencileri için İslami ahlak konularını işleyen interaktif tiyatro oyunu. 'Dürüstlük' konusunu işleyen kısa bir oyun sahnelenecek, ardından çocuklar kendi senaryolarını yazıp oynayacak. Oyun sonunda tartışma ve ödül dağıtımı yapılacak.",
  "targetAudience": "middle_school",
  "category": "kultur",
  "keyTopics": ["Dürüstlük", "Güven", "Ahlak ve sanat", "Yaratıcılık"],
  "resourcesNeeded": "Sahne düzeni, kostümler, mikrofon, dekor, ödüller (kitap, kalem seti)",
  "estimatedParticipants": "20-30 çocuk",
  "islamicSession": {
    "title": "Efendimizin Dürüstlüğü: Sıddık Ünvanı",
    "description": "Tiyatro öncesi 20 dakikalık sohbet. Hz. Muhammed'in çocukluk ve gençlik yıllarındaki dürüstlük örnekleri anlatılacak. 'Sıddık' ünvanının anlamı açıklanacak.",
    "duration": "20 dk"
  }
}`,

`## Örnek: Umumi İbadet
{
  "title": "Regaib Gecesi Özel Programı: Dua ve İstiğfar Buluşması",
  "description": "Regaib Gecesi münasebetiyle düzenlenecek özel bir ibadet ve dua programı. Gecenin faziletleri anlatılacak, hatim duası yapılacak, tesbihat ve zikir çekilecek. Ardından lokma ikramı ile kardeşlik sohbeti gerçekleştirilecek.",
  "targetAudience": "general",
  "category": "ibadet",
  "keyTopics": ["Regaib Gecesi'nin fazileti", "Dua ve istiğfar", "Hatim duası", "Zikir ve tesbihat"],
  "resourcesNeeded": "Mekan süslemesi, ses sistemi, Kur'an-ı Kerim, tesbih, lokma malzemeleri, çay",
  "estimatedParticipants": "50-80 kişi",
  "islamicSession": {
    "title": "Regaib Gecesi'nin Fazileti ve Önemi",
    "description": "Programın başında 30 dakikalık sohbet. Regaib Gecesi'nin anlamı, bu gece yapılacak ibadetler ve duaların önemi anlatılacak.",
    "duration": "30 dk"
  }
}`,

`## Örnek: Lise - Eğlence + İslami Ders
{
  "title": "Gençler Piknik ve Doğa Yürüyüşü: Yaratılış Delilleri",
  "description": "Lise öğrencileri için doğa yürüyüşü ve piknik etkinliği. Belirlenen parkurda yürüyüş yapılacak, doğadaki güzellikler gözlemlenecek, ardından piknik alanında mangal ve sohbet yapılacak.",
  "targetAudience": "high_school",
  "category": "genclik",
  "keyTopics": ["Doğa sporları", "Yürüyüş", "Kardeşlik", "Sağlıklı yaşam"],
  "resourcesNeeded": "Ulaşım aracı, piknik malzemeleri, mangal, yiyecek, içecek, ilk yardım çantası",
  "estimatedParticipants": "15-25 lise öğrencisi",
  "islamicSession": {
    "title": "Doğada Yaratılış Delillerini Görmek",
    "description": "Piknik sırasında 20 dakikalık açık hava sohbeti. Kur'an-ı Kerim'de geçen 'yaratılış delilleri' ayetleri okunacak.",
    "duration": "20 dk"
  }
}`,

`## Örnek: Ortaokul - Eğitim + İslami Ders
{
  "title": "Küçük Hafızlar Yarışması: Kur'an-ı Kerim'i Güzel Okuma",
  "description": "Ortaokul öğrencileri için Kur'an-ı Kerim'i güzel okuma yarışması. Her öğrenci kısa bir sure okuyacak, jüri değerlendirmesi yapılacak. Yarışma sonunda tüm katılımcılara katılım sertifikası ve küçük hediyeler verilecek.",
  "targetAudience": "middle_school",
  "category": "egitim",
  "keyTopics": ["Kur'an okuma", "Tecvit", "Güzel ahlak", "Yarışma ve ödül"],
  "resourcesNeeded": "Ses sistemi, mikrofon, jüri masası, sertifikalar, ödüller, çay ikramı",
  "estimatedParticipants": "10-20 çocuk",
  "islamicSession": {
    "title": "Kur'an'ın Hayatımızdaki Yeri ve Önemi",
    "description": "Yarışma öncesi 15 dakikalık sohbet. Kur'an-ı Kerim'in günlük hayatımızdaki yeri, okumanın faziletleri ve tecvidin önemi anlatılacak.",
    "duration": "15 dk"
  }
}`,

`## Örnek: Lise - Kültür + İslami Ders
{
  "title": "Gençler Film Gecesi: 'Bilal' ve Adalet Müzakere",
  "description": "Lise öğrencileri için 'Bilal: Yeni Bir Çağın Çağrısı' veya benzeri İslami içerikli film gösterimi. Film sonunda 30 dakikalık müzakere oturumu yapılacak. Adalet, özgürlük ve kardeşlik temaları tartışılacak.",
  "targetAudience": "high_school",
  "category": "kultur",
  "keyTopics": ["Adalet ve İslam", "Sahabe hayatı", "Müzakere becerisi", "Medya okuryazarlığı"],
  "resourcesNeeded": "Projeksiyon, perde, ses sistemi, patlamış mısır, meyve suyu, tartışma kartları",
  "estimatedParticipants": "15-25 lise öğrencisi",
  "islamicSession": {
    "title": "Bilal-i Habeşi ve Eşitlik Dersi",
    "description": "Film öncesi 20 dakikalık sohbet. Bilal-i Habeşi'nin hayatı, İslam'da eşitlik ve adalet anlayışı üzerine derinlemesine bir giriş yapılacak.",
    "duration": "20 dk"
  }
}`,

`## Örnek: Ortaokul - Sosyal Sorumluluk + İslami Ders
{
  "title": "Küçük Eller, Büyük Yardımlar: Gıda Kolisi Paketleme",
  "description": "Ortaokul öğrencileri için sosyal sorumluluk etkinliği. Çocuklar ihtiyaç sahibi aileler için gıda kolisi hazırlayacak, paketleyecek ve notlar yazacak. Etkinlik sonunda koli teslimi için dua edilecek.",
  "targetAudience": "middle_school",
  "category": "sosyal_sorumluluk",
  "keyTopics": ["Yardımseverlik", "İnfak", "Dua ve niyet", "Kardeşlik"],
  "resourcesNeeded": "Gıda malzemeleri, koli kutuları, kalem, kağıt, paketleme malzemeleri, taşıma aracı",
  "estimatedParticipants": "15-20 çocuk",
  "islamicSession": {
    "title": "İnfak ve Cömertlik: Efendimizin Örnekleri",
    "description": "Paketleme öncesi 15 dakikalık sohbet. Hz. Muhammed'in cömertliği, infakın önemi ve yardım etmenin İslam'daki yeri anlatılacak.",
    "duration": "15 dk"
  }
}`,

`## Örnek: Umumi - Aile + İslami Ders
{
  "title": "Aile İftarı ve Sofra Adabı Programı",
  "description": "Tüm ailelerin katılımıyla düzenlenecek özel bir iftar programı. İftar öncesi sofra adabı ve paylaşmanın önemi üzerine kısa bir sohbet yapılacak. Aileler birlikte oruç açacak, ardından çocuklar için oyun köşesi, yetişkinler için sohbet halkası oluşturulacak.",
  "targetAudience": "general",
  "category": "aile",
  "keyTopics": ["Sofra adabı", "Aile içi iletişim", "Paylaşma ve bereket", "Oruç ve aile"],
  "resourcesNeeded": "İftar yemekleri, masa düzeni, çocuk oyun alanı, ses sistemi, sohbet alanı",
  "estimatedParticipants": "30-50 kişi (aileler dahil)",
  "islamicSession": {
    "title": "Sofrada Bereket ve Adab",
    "description": "İftar öncesi 20 dakikalık sohbet. Peygamber Efendimiz'in sofra adabı, yemek duası ve paylaşmanın önemi üzerine interaktif bir anlatım yapılacak.",
    "duration": "20 dk"
  }
}`,

`## Örnek: Lise - Eğitim + İslami Ders
{
  "title": "Gençler Arapça Atölyesi: Kur'an'ın Dilini Keşfet",
  "description": "Lise öğrencileri için temel Arapça atölye çalışması. Kur'an-ı Kerim'den seçilmiş kelimeler üzerinden Arapça'nın temel yapısı öğretilecek. Öğrenciler kendi mini sözlüklerini oluşturacak.",
  "targetAudience": "high_school",
  "category": "egitim",
  "keyTopics": ["Arapça temeller", "Kur'an kelimeleri", "Dil öğrenme", "Kültürel köprü"],
  "resourcesNeeded": "Ders notları, kalem, kağıt, projeksiyon, Arapça sözlük, çay ikramı",
  "estimatedParticipants": "10-15 lise öğrencisi",
  "islamicSession": {
    "title": "Kur'an'ın Dili: Arapça'nın İslam'daki Yeri",
    "description": "Atölye öncesi 15 dakikalık sohbet. Kur'an-ı Kerim'in orijinal dili olan Arapça'nın önemi, anlam katmanları ve öğrenmenin fazileti anlatılacak.",
    "duration": "15 dk"
  }
}`,

`## Örnek: Ortaokul - Gençlik + İslami Ders
{
  "title": "Küçük Müminler Spor Şenliği: Koşu ve Kardeşlik",
  "description": "Ortaokul öğrencileri için parkurda düzenlenecek mini atletizm şenliği. Koşu, ip atlama, çuval yarışı gibi etkinlikler olacak. Her yarış sonunda katılım sertifikası verilecek.",
  "targetAudience": "middle_school",
  "category": "genclik",
  "keyTopics": ["Spor ve sağlık", "Kardeşlik", "Centilmenlik", "Beden eğitimi"],
  "resourcesNeeded": "Parkur alanı, ödüller, sertifikalar, su, ilk yardım çantası, taşıma aracı",
  "estimatedParticipants": "20-30 çocuk",
  "islamicSession": {
    "title": "Sahabe Gençleri ve Beden Eğitimi",
    "description": "Şenlik öncesi 15 dakikalık sohbet. Sahabelerin güreş, at yarışı ve okçuluk gibi sporlardaki örnek davranışları anlatılacak. Sporda centilmenlik ve kardeşlik vurgulanacak.",
    "duration": "15 dk"
  }
}`,

`## Örnek: Umumi - Kültür + İslami Ders
{
  "title": "Ebru Sanatı ve Tezhip Atölyesi: İslami Sanatlarla Buluşma",
  "description": "Tüm yaş gruplarına yönelik geleneksel İslami sanatlar atölyesi. Usta ebru sanatçısı eşliğinde katılımcılar kendi ebru tablolarını yapacak. Ardından tezhip sanatına giriş yapılacak.",
  "targetAudience": "general",
  "category": "kultur",
  "keyTopics": ["Ebru sanatı", "Tezhip", "İslami sanatlar", "Geleneksel kültür"],
  "resourcesNeeded": "Ebru tekneleri, boyalar, kağıt, tezhip malzemeleri, masa örtüleri, çay ikramı",
  "estimatedParticipants": "15-20 kişi",
  "islamicSession": {
    "title": "Sanatta Tevhit ve Güzellik Anlayışı",
    "description": "Atölye öncesi 20 dakikalık sohbet. İslam'da sanat ve estetik anlayışı, tevhit bilincinin sanata yansıması, geometrik desenlerin anlamı üzerine konuşulacak.",
    "duration": "20 dk"
  }
}`,

`## Örnek: Lise - Sosyal Sorumluluk + İslami Ders
{
  "title": "Gençler Çevre Timi: Park Temizliği ve Farkındalık",
  "description": "Lise öğrencileri için çevre temizliği ve farkındalık etkinliği. Belirlenen parkta çöp toplama, geri dönüşüm eğitimi ve afiş hazırlama çalışması yapılacak.",
  "targetAudience": "high_school",
  "category": "sosyal_sorumluluk",
  "keyTopics": ["Çevre koruma", "Geri dönüşüm", "Sorumluluk", "Toplumsal duyarlılık"],
  "resourcesNeeded": "Eldivenler, çöp poşetleri, geri dönüşüm kutuları, afiş malzemeleri, su, taşıma aracı",
  "estimatedParticipants": "15-25 lise öğrencisi",
  "islamicSession": {
    "title": "İslam'da Çevre ve Emânət",
    "description": "Temizlik öncesi 15 dakikalık sohbet. Dünyanın bir emanet olduğu, çevreyi korumanın İslami sorumluluğumuz olduğu ve Hz. Muhammed'in çevre duyarlılığı üzerine konuşulacak.",
    "duration": "15 dk"
  }
}`,
];

// ---------------------------------------------------------------------------
// System prompt (static part)
// ---------------------------------------------------------------------------

export const SUGGEST_ISLAMIC_EVENTS_SYSTEM_PROMPT = `
Sen, Türkiye'deki bir İslami derneğin etkinlik planlayıcısısın.
Görevin: derneğin haftalık veya aylık İslami çalışmaları için zengin, detaylı ve uygulanabilir etkinlik önerileri üretmek.

# KATI KURALLAR
1. TÜM öneriler İSLAMİ TEMA veya İSLAM'A UYGUN eğlence içermelidir. Laik, politik, tarafsız veya İslam dışı hiçbir etkinlik önerme.
2. HER etkinlikte mutlaka bir İSLAMİ İLİMLER dersi/sohbet bölümü olmalıdır. Eğlence veya sosyal aktivite olsa bile, etkinliğin bir bölümünde İslami bir konu anlatılmalıdır.
3. Öneriler Türkçe olmalı ve Türkiye'deki bir dernek için uygun olmalı.
4. Çıktı SADECE aşağıdaki JSON formatında olmalı. Markdown, açıklama, özet, giriş/sonuç YOK.
5. title: 120 karakteri geçmemeli, çekici ve net olmalı.
6. description: En az 10, en fazla 800 karakter. Etkinliğin ne yapılacağını, amacını, kime hitap ettiğini, nasıl bir atmosfer olacağını anlat.
7. targetAudience SADECE şunlardan biri: "middle_school" (ortaokul), "high_school" (lise), "general" (umumi/herkes).
8. category SADECE şunlardan biri: "sohbet", "egitim", "kultur", "genclik", "aile", "sosyal_sorumluluk", "ibadet".
10. keyTopics: 1-6 arası dizi. Etkinliğin işleyeceği ana konu başlıkları.
11. resourcesNeeded: Gerekli materyaller, mekan, ekipman (örn: "Projeksiyon, not kağıtları, çay ikramı").
12. estimatedParticipants: Tahmini katılımcı sayısı aralığı (örn: "15-25 kişi", "10-15 çocuk").
13. islamicSession: Her etkinlikte olması ZORUNLU olan İslami ilimler dersi/sohbet bölümü.
    - islamicSession.title: Dersin/sohbetin başlığı (örn: "Peygamberimizin Gençlik Örnekleri")
    - islamicSession.description: Bu bölümde neler yapılacağı, hangi konuların işleneceği (örn: "Etkinlik öncesi 20 dakikalık sohbet. Hz. Muhammed'in gençlik yıllarından örnekler verilerek, günlük hayatta sabır ve kararlılık konuları işlenecek.")
    - islamicSession.duration: Tahmini süre (örn: "20-30 dk", "15 dk")
14. Her seferinde FARKLI öneriler üret. Aynı etkinliği tekrar etme.
15. Gerçekçi ol. Utopik, imkansız veya aşırı maliyetli etkinlikler önerme.

# HEDEF KİTLELER
## Ortaokul (middle_school)
- Yaş: 10-14
- Dikkat süresi kısa, görsel ve uygulamalı aktiviteler gerekli
- Konular: Peygamberlerin hayatı, İslami hikayeler, temel ibadetler, güzel ahlak, kardeşlik oyunları, Kur'an-ı Kerim'i tanıma
- Eğlence formatları: Tiyatro, bowling, sinema (İslami içerikli), bilardo turnuvası, spor müsabakaları, oyun günleri, piknik, bilgi yarışmaları, şarkı söyleme
- ÖNEMLİ: Her eğlence etkinliğinin içinde veya başında mutlaka kısa bir İslami sohbet veya ders olmalı

## Lise (high_school)
- Yaş: 15-18
- Sorgulayan zihin, derin sohbetler, güncel bağlantılar
- Konular: Sahabe hayatları, İslam'da ahlak ve erdem, güncel İslami meseleler, gençlik ve iman, tarihi şahsiyetler, Kur'an tefsir dersleri
- Eğlence formatları: Film gösterimi + müzakere, bowling, bilardo turnuvası, spor turnuvası, konser (İslami), doğa yürüyüşü, kamplar, piknik
- ÖNEMLİ: Her eğlence etkinliğinin içinde veya başında mutlaka kısa bir İslami sohbet veya ders olmalı

## Umumi (general)
- Yaş: Herkes
- Konular: Aile içi iletişim, ilmihal dersleri, tasavvufi sohbetler, İslami sanatlar, hayatın her alanında İslam, hatim programları, Mevlid, Regaib, Kandil programları
- Örnek formatlar: Konferans, sohbet toplantısı, eğitim semineri, sosyal sorumluluk projesi, iftar organizasyonu

# KATEGORİ TANIMLARI
- sohbet: Dini sohbet, tasavvufi sohbet, konferans, panel, misafir konuşmacı
- egitim: İlmihal, Kur'an eğitimi, siyer dersi, Arapça, hafızlık, kitap tahlili
- kultur: İslami sanat (ebru, hat, tezhip), şiir dinletisi, tiyatro, sergi, belgesel gösterimi, sinema (İslami içerikli)
- genclik: Gençlik özel etkinlikleri, gençlik kampları, spor turnuvası (bowling, bilardo, futbol, voleybol), gençlik buluşmaları, oyun günleri, piknik
- aile: Aile eğitimi, evlilik öncesi eğitim, çocuk yetiştirme, aile içi iletişim
- sosyal_sorumluluk: Yardım faaliyeti, ziyaretler (hasta, yaşlı), çevre temizliği, kan bağışı, gıda kolisi
- ibadet: Hatim programı, teravih, Mevlid, Kandil programı, Regaib, Berat, Kadir gecesi programı

# ETKİNLİK TİPLERİ (İslami çerçevede)
1. PURE_ISLAMIC: Tamamen İslami içerikli (sohbet, eğitim, ibadet)
2. ISLAMIC_ENTERTAINMENT: Eğlenceli aktivite ama İslami çerçevede ve İslami ders içeriyor
   - Ortaokul/Lise için örnekler: Bowling + sohbet, Sinema (İslami film) + müzakere, Bilardo turnuvası + ders, Spor müsabakası + sahabe hayatı anlatımı, Oyun günü + güzel ahlak dersi, Piknik + Kur'an-ı Kerim'i tanıma

# ÇIKTİ FORMATI (KESİNLİKLE BUNUN DIŞINA ÇIKMA)
{
  "suggestions": [
    { 
      "title": "...", 
      "description": "...", 
      "targetAudience": "...", 
      "category": "...", 
      "keyTopics": ["..."], 
      "resourcesNeeded": "...", 
      "estimatedParticipants": "...",
      "islamicSession": {
        "title": "...",
        "description": "...",
        "duration": "..."
      }
    }
  ]
}
`;

// ---------------------------------------------------------------------------
// User prompt builder
// ---------------------------------------------------------------------------

export function buildIslamicEventsUserPrompt(
  period: 'weekly' | 'monthly',
  targetAudience: 'all' | 'middle_school' | 'high_school',
  currentDate: string,
  pastEventTitles: string[],
  associationProfile?: {
    memberCount: number;
    city: string;
    pastCategoryBreakdown: Record<string, number>;
    averageAttendance?: number;
  },
  upcomingHolidays?: { name: string; date: string; daysUntil: number }[],
): string {
  const periodLabel = period === 'weekly' ? 'haftalık' : 'aylık';
  const audienceLabel =
    targetAudience === 'all'
      ? 'TÜM hedef kitleler için (Ortaokul, Lise ve Umumi)'
      : targetAudience === 'middle_school'
        ? 'SADECE Ortaokul öğrencileri için'
        : 'SADECE Lise öğrencileri için';

  const avoidSection =
    pastEventTitles.length > 0
      ? `\nAŞAĞIDAKİ etkinlikleri TEKRAR ETME (daha önce önerilmiş):\n${pastEventTitles.map((t) => `- ${t}`).join('\n')}`
      : '';

  const profileSection = associationProfile
    ? `\n# DERNEK PROFİLİ\n- Şehir: ${associationProfile.city}\n- Üye Sayısı: ${associationProfile.memberCount}\n- Geçmiş Etkinlik Kategori Dağılımı:\n${Object.entries(associationProfile.pastCategoryBreakdown).map(([cat, count]) => `  - ${cat}: ${count} etkinlik`).join('\n')}\n${associationProfile.averageAttendance ? `- Ortalama Katılım: ${associationProfile.averageAttendance} kişi` : ''}`
    : '';

  const holidaysSection =
    upcomingHolidays && upcomingHolidays.length > 0
      ? `\n# YAKLAŞAN İSLAMİ ÖZEL GÜNLER\n${upcomingHolidays.map((h) => `- ${h.name}: ${h.date} (${h.daysUntil} gün sonra)`).join('\n')}\n\nEğer yaklaşan bir özel gün varsa, ona uygun etkinlik önerileri üret. Örneğin Regaib Gecesi yakınsa ibadet kategorisinde özel program öner.`
      : '';

  // Randomly pick 3 few-shot examples so the model never memorises the same set
  const selectedExamples = pickRandomSubset(FEW_SHOT_EXAMPLES, 3);
  const fewShotBlock = selectedExamples.length > 0
    ? `\n# ÖRNEK ÇIKTILAR (Few-shot)\n${selectedExamples.join('\n\n')}`
    : '';

  return `
Bugünün tarihi: ${currentDate}
İstenen periyot: ${periodLabel}
Hedef kitle: ${audienceLabel}
${profileSection}
${holidaysSection}

${periodLabel === 'haftalık' ? 'Önümüzdeki hafta' : 'Önümüzdeki ay'} için ${targetAudience === 'all' ? 'her hedef kitleye en az 1, toplamda 6-8' : '4-6'} adet İSLAMİ veya İSLAM'A UYGUN etkinlik önerisi üret.

ÖNEMLİ TALİMATLAR:
1. Ortaokul ve lise öğrencileri İÇİN hem eğlenceli hem de İslami içerikli etkinlikler üret.
   - Eğlence örnekleri: Bowling, bilardo, sinema (İslami film), tiyatro, spor müsabakaları, oyun günleri, piknik, bilardo turnuvası
   - Her eğlence etkinliğinde mutlaka bir İslami ders/sohbet bölümü olsun (islamicSession alanı)
2. Umumi kitle için geleneksel İslami etkinlikler (sohbet, eğitim, ibadet) de üret.
3. Çocukların hem eğlenmesi hem de İslam'ı tanıması amacı gütmelisin.
4. Her öneri için TÜM alanları doldur, özellikle islamicSession alanını eksiksiz doldur.
5. Açıklamalar detaylı ve uygulanabilir olsun.
6. Derneğin geçmiş kategori dağılımına bak: az yapılan kategorilerden daha fazla öneri üret.
${avoidSection}

ÖNERİLERİN çeşitli kategorilerden (sohbet, eğitim, kültür, gençlik, aile, sosyal_sorumluluk, ibadet) seçilmesine özen göster.

${buildCreativityPrompt()}
${fewShotBlock}
`.trim();
}
