#!/bin/bash
# =============================================================================
# Finans Modülü Yeni Özellikler - Test Senaryoları
# =============================================================================
# Bu dosyayı çalıştırmadan önce:
# 1. docker compose up -d
# 2. pnpm db:generate && pnpm db:migrate
# 3. pnpm dev
# =============================================================================

API_URL="${API_URL:-http://localhost:3000/api/v1}"

echo "============================================"
echo "FINANS MODULU TEST SENARYOLARI"
echo "============================================"

# NOT: TOKEN değerini gerçek bir JWT ile değiştirmelisiniz
# Supabase'den login olup token'ı alın
TOKEN="YOUR_JWT_TOKEN"
ASSOC_ID="YOUR_ASSOCIATION_ID"

echo ""
echo "--- 1. Bulk Aidat Tahsilatı ---"
echo "POST ${API_URL}/associations/${ASSOC_ID}/finance/fees/bulk"
echo ""
echo 'Örnek curl komutu:'
cat << 'EOF'
curl -X POST "${API_URL}/associations/${ASSOC_ID}/finance/fees/bulk" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "payments": [
      {
        "membershipId": "mem-ahmet-yilmaz",
        "amountInKurus": 50000,
        "month": "2026-05",
        "description": "Aidat - Mayıs 2026"
      },
      {
        "membershipId": "mem-fatma-demir",
        "amountInKurus": 50000,
        "month": "2026-05"
      },
      {
        "membershipId": "mem-mehmet-kaya",
        "amountInKurus": 50000,
        "month": "2026-05"
      }
    ]
  }'
EOF

echo ""
echo "Beklenen yanıt:"
cat << 'EOF'
{
  "successCount": 3,
  "skippedCount": 0,
  "skipped": [],
  "totalAmountKurus": 150000
}
EOF

echo ""
echo "--- 2. Ödenmeyen Üyeleri Listele ---"
echo "GET ${API_URL}/associations/${ASSOC_ID}/finance/fees/unpaid?month=2026-05"
echo ""
echo 'Örnek curl komutu:'
cat << 'EOF'
curl "${API_URL}/associations/${ASSOC_ID}/finance/fees/unpaid?month=2026-05" \
  -H "Authorization: Bearer ${TOKEN}"
EOF

echo ""
echo "Beklenen yanıt:"
cat << 'EOF'
[
  {
    "membershipId": "mem-1",
    "userId": "u1",
    "fullName": "Ahmet Yılmaz",
    "hasPaid": false,
    "monthlyFeeAmountKurus": 50000
  },
  {
    "membershipId": "mem-2",
    "userId": "u2",
    "fullName": "Fatma Demir",
    "hasPaid": true,
    "monthlyFeeAmountKurus": 50000
  }
]
EOF

echo ""
echo "--- 3. Sık Kullanılan Kategoriler ---"
echo "GET ${API_URL}/associations/${ASSOC_ID}/finance/frequent-categories"
echo ""
echo 'Örnek curl komutu:'
cat << 'EOF'
curl "${API_URL}/associations/${ASSOC_ID}/finance/frequent-categories" \
  -H "Authorization: Bearer ${TOKEN}"
EOF

echo ""
echo "Beklenen yanıt:"
cat << 'EOF'
[
  { "id": "cat-1", "name": "Kira", "type": "EXPENSE", "count": 5 },
  { "id": "cat-2", "name": "Fatura", "type": "EXPENSE", "count": 3 },
  { "id": "cat-3", "name": "Aidat Geliri", "type": "INCOME", "count": 2 }
]
EOF

echo ""
echo "--- 4. Telegram Bot Akış Hızlandırma ---"
echo ""
echo "Mevcut akış (6-7 adım):"
echo "  /finans → Dernek seç → Tip seç → Kategori seç → Tutar gir → Açıklama gir → Tarih seç → Onayla"
echo ""
echo "Yeni akış (3-4 adım):"
echo "  /gider 500 Kira → Kategori seç (⭐ Son kullanılan önde) → Açıklama → ✅ Onayla"
echo ""
echo "Akıllı tutar önerisi:"
echo "  Kategori seçildiğinde son girilen tutar gösterilir:"
echo "  💡 Son tutar: 5000.00 TL"
echo "  Bu tutarı kullanmak için '5000' yazın veya yeni tutar girin:"

echo ""
echo "============================================"
echo "TEST SENARYOLARI TAMAMLANDI"
echo "============================================"
