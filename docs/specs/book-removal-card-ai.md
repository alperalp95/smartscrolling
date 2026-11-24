# Spec — Kitap bölümünün kaldırılması ve "Karta Sor" (AI)

**Durum:** Kararlar alındı, kullanıcı onayı bekliyor · **Yazan:** Atlas (PO) · **Tarih:** 2026-11-24

## 1. Neden

- Uygulamadaki 8 kitabın hepsi telif hakkı süren Türkçe çeviri (Harari ×2, Kahneman, Bryson, Diamond, Krauss, Warburton, Darwin çevirisi). Veritabanında hepsi yanlışlıkla `public_domain` diye işaretli.
- Tam metin (~840 bin kelime) **herkese açık GitHub reposunda** bir migration dosyasında duruyor. Ayrıca veritabanında giriş yapmadan okunabiliyor (premium kilidi sadece uygulamada).
- Repoda ayrıca "Lüzumsuz Bilgiler Ansiklopedisi" kitabının PDF'ten çıkarılmış metni (`packages/pipeline/data/pdf-curated/`) ve 7 kitabın vurgu dosyaları (`data/highlights/`) var. Yayındaki 713 kartın 254'ü bu kitaptan türetilmiş.
- Kullanım çok düşük: 4 kullanıcı, kitap açan 2 kişi, kitaplarda toplam 1 AI sohbeti.
- Kitapta AI soru fikri iyi, ama uygulaması zayıf ve şu an muhtemelen çalışmıyor (Upstash bağımlılığı). Premium vaatleri tutmuyor ("Sınırsız AI" yazıyor, sunucu en fazla 50 veriyor; ödeme yapan kullanıcı sunucuda premium işaretlenmiyor).

## 2. Hedef

1. Telifli içeriğin uygulamadan, veritabanından ve repodan çıkması.
2. AI soru özelliğinin uygulamanın asıl ürününe, **bilgi kartlarına** taşınması: kartın altında "Sor" → "Neden böyle?", "Daha fazla anlat", "Basitçe açıkla" ve (premium'da) serbest soru.
3. Premium'un dürüst ve çalışan vaatlerle yeniden tanımlanması.
4. **0 $** kalmak (ücretsiz modeller), içerik hattının kotasıyla çakışmamak.

## 3. Kapsam dışı

- Yeni bir kitap rafı (ileride sadece yazarı 70+ yıl önce ölmüş Türkçe eserlerle düşünülebilir; ayrı spec).
- Sohbet geçmişinin saklanması (sohbetler kaydedilmez; gizlilik ve basitlik).
- Misafir (giriş yapmamış) kullanıcıya AI (giriş zorunlu; bu aynı zamanda kayıt teşviki).

## 4. Kullanıcı deneyimi — "Karta Sor"

- Akıştaki her kartta küçük bir **"Sor"** butonu (kaynak bağlantısının yanında).
- Basınca alttan bir panel açılır: kart başlığı, 3 hazır soru çipi, altında soru kutusu.
  - Ücretsiz: hazır sorular. Serbest soru kutusu kilitli, "Premium ile kendi sorunu sor" yazar.
  - Premium: hazır sorular + serbest soru.
- Cevap kısa (en fazla ~5 cümle), Türkçe, sadece kartın ve kaynağın söylediğine dayanır. Bilmiyorsa "Kaynakta bu yok" der.
- Her cevabın altında "Yanlış içeriği bildir" (mevcut rapor akışı karta uyarlanır).
- Misafir kullanıcı "Sor"a basınca giriş isteme ekranı çıkar.
- Günlük hak dolunca: ücretsizde premium teklifi, premium'da "Yarın yenilenir".
- Panel kapanınca sohbet unutulur.

## 5. Teknik tasarım (özet)

**Bağlam:** Modele gönderilen bağlam = kart başlığı + metni + kaynak paragrafı.
- Yeni kolon `facts.context_text` (en fazla ~2000 karakter).
- Yeni hat (v2) kartları: sıraya alınırken destek paragrafı bu kolona yazılır.
- Eski kartlar: bir kerelik script kaynak bağlantısındaki Wikipedia paragrafını çekip doldurur. Bulunamazsa sadece kart metni kullanılır.

**Sunucu:** Yeni edge function `card-ask`.
- Giriş zorunlu (JWT doğrulanır). İstemciden sadece `factId` + soru + (en fazla 4 mesajlık) geçmiş gelir. **Bağlamı sunucu veritabanından okur**, istemciye güvenmez.
- Kota Postgres'te tutulur (yeni `ai_usage` tablosu + tek adımda artıran fonksiyon). **Upstash kalkar.** Kota servisi hata verirse istek reddedilir.
- Sınırlar: soru ≤300 karakter, geçmişte sadece `user`/`assistant` rolü, cevap `max_tokens` ~400, 20 sn zaman aşımı.
- Model: Groq'ta içerik hattının **kullanmadığı** bir model (Groq limitleri model başına; böylece hat ile yarışmaz). Kesin model, uygulama sırasında Groq'un güncel listesinden seçilir. Yedek: Gemini.
- Hazır sorular sunucuda da tanımlı. Ücretsiz kullanıcı serbest soru gönderirse sunucu reddeder (bugün bu kısıt sadece uygulamada).

**Premium'un sunucuda tanınması:** RevenueCat → Supabase webhook'u (`revenuecat-webhook`) satın alma/iptal olayında kullanıcının `app_metadata.premium` alanını günceller. Bugün bu yok; premium kullanıcı da ücretsiz kotası alıyor.

**Kaldırılanlar:**
- Uygulama: Kütüphane sekmesi, okuyucu, kitap sayfası, kitap/sohbet/tanım kodları, FTUE'deki "ücretsiz kitap" yolu, premium ekranındaki kitap/sohbet geçmişi maddeleri, Maestro kütüphane akışı.
- Veritabanı: `books`, `book_sections`, `book_highlights`, `reading_progress`, `chat_sessions` tabloları, `book-files` deposu. `bookmarks.book_id` kolonu (kartlar için kullanılan `fact_id` kalır). `user_activity.pages_read` kolonu zararsız, kalır ama yazılmaz.
- Edge function'lar: `ai-chat`, `ai-definition` (yerine `card-ask`).
- Repo: kitap/PDF veri dosyaları, kitap script'leri, çalışmayan `books:*` script'leri. Tam metin içeren migration dosyaları **silinmez** (Supabase'in migration geçmişi bozulmasın diye), içerikleri "telif nedeniyle kaldırıldı" yorumuyla boşaltılır.

**Sıra:** Uygulama mağazada olmadığı için eski sürüm uyumluluğu gerekmez (karar 6).
1. Önce erişimi kapat (repo private + kitap metnini veritabanında okunamaz yap). Eski sürümde kütüphane boş görünür; kabul.
2. Karta Sor altyapısı + yeni uygulama sürümü.
3. Tabloları/fonksiyonları/dosyaları sil (yeni sürümü beklemeden).

## 6. Premium — yeni vaatler (öneri)

| Eski | Yeni |
|---|---|
| Reklamsız deneyim | Reklamsız deneyim (aynı) |
| Tüm kütüphane erişimi | — (kalkar) |
| Sınırsız AI soruları | **Günde 30 "Karta Sor" + kendi sorunu yazma** |
| AI sohbet geçmişi | — (kalkar) |
| — | (öneri) Kaydedilen kartlar sınırsız / gelişmiş kategori seçimi — ayrı karar |

Ücretsiz: günde **3** hazır soru. (Sayılar config'te; kod bilmeyen biri değiştirebilir.)

## 7. Kararlar (kullanıcı, 2026-11-24)

1. **Repo:** private yapılacak (kullanıcı yapar).
2. **Git geçmişi:** şimdi temizlenmeyecek; private yeterli.
3. **Lüzumsuz Bilgiler'den türeyen 254 kart:** yayında **kalır**. Ama kitabın PDF'ten çıkarılmış ham metni (`data/pdf-curated/`) repodan yine kaldırılır.
4. **Kotalar:** ücretsiz 3/gün, premium 30/gün (config'te).
5. **Premium:** "reklamsız + günde 30 Karta Sor + kendi sorunu yazma". Yeni madde şimdilik yok.
6. **Uygulama mağazada yayında değil:** eski sürüm uyumluluğu gerekmez. Temizlik (Faz 3) yeni sürümün yayınlanmasını beklemez, Faz 2 ile birlikte yapılabilir.

## 8. Başarı ölçütü

- Repoda ve veritabanında telifli tam metin yok (Bekçi doğrular). Anahtar ile REST'ten kitap metni çekilemiyor.
- Karta Sor: hazır soruya cevap 5 sn altında, kaynağa sadık (Bekçi 20 kartla örnekleme yapar).
- Kota, giriş, premium ayrımı **sunucuda** çalışıyor (testlerle).
- Premium satın alan kullanıcı webhook ile sunucuda premium oluyor (RevenueCat sandbox ile).
- typecheck, lint, birim testler, pipeline testleri, Maestro (misafir + hesap) yeşil.
