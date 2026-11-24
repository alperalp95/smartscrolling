# Plan — Kitap kaldırma + "Karta Sor"

Spec: `docs/specs/book-removal-card-ai.md` · **Kod, kullanıcı "onaylıyorum / başlasın" dedikten sonra başlar.**

Kural: bir kart = tek konu, ideal ≤3 dosya. Model: haiku (mekanik), sonnet (net kart), opus (yok). Her kart sonunda testler + yerel commit; Atlas doğrular.

## Faz 0 — Acil kapatma (aynı gün)

| # | İş | Kim | Model | Dosya |
|---|---|---|---|---|
| K-00a | Repoyu private yap | **Kullanıcı** (GitHub → Settings → Change visibility) | — | — |
| K-00b | `books`/`book_sections`/`book_highlights` okuma politikalarını kaldır (anon + authenticated). Eski uygulamada kütüphane boş görünür. | Köprü | sonnet | 1 migration + PGlite testi |

## Faz 1 — Karta Sor altyapısı (paralel)

| # | İş | Kim | Model | Bağımlılık |
|---|---|---|---|---|
| K-01 | Migration: `ai_usage(user_id, day, count)` + `consume_ai_quota(p_limit)` (SECURITY DEFINER, atomik, `search_path=''`, sadece service_role) · `facts.context_text text` · `ai_content_reports.fact_id` (FK facts, SET NULL) | Köprü | sonnet | K-00b |
| K-02 | Edge function `card-ask` (bağlamı DB'den okur, kota, sınırlar, hazır sorular, free/premium ayrımı, Groq + Gemini yedek) + saf yardımcı modül testleri + `config.toml` + `eas-build.yml` kontrolü | Köprü | sonnet | K-01 |
| K-03 | Pipeline: enqueue'da `context_text` = destek paragrafı (≤2000 karakter) + eski kartlar için `v2-backfill-context` script'i (Wikipedia, varsayılan dry-run) | Değirmen | sonnet | K-01 |
| K-04 | Edge function `revenuecat-webhook`: imza/secret doğrulama, olay → `app_metadata.premium` true/false | Köprü | sonnet | — (RevenueCat webhook secret'ı kullanıcıdan) |
| K-05 | Mobil saf mantık: `src/lib/cardAsk.ts` (çağrı, hata → Türkçe mesaj, hazır sorular, kota durumu) + jest testleri | Usta | sonnet | K-02 sözleşmesi (karta yazılır) |

## Faz 2 — Uygulama

| # | İş | Kim | Model | Bağımlılık |
|---|---|---|---|---|
| K-06 | "Sor" butonu + alt panel (`CardAskSheet`), misafirde giriş isteği, premium kilidi, rapor butonu | Fırça | sonnet | K-05 |
| K-07a | Kütüphane sekmesi, okuyucu, `book/[id]` rotası ve kitap/sohbet/tanım `src/lib` dosyalarının silinmesi + tab layout | Fırça | sonnet | — (K-06 ile aynı dosyalara dokunmaz) |
| K-07b | FTUE "ücretsiz kitap" yolu, premium ekranı yeni vaatler, tipler, akıştaki "kitaplık" metni | Fırça | sonnet | K-07a |
| K-08 | Maestro: `card-ask` hesap akışı, kütüphane akışını sil, `basic-navigation` güncelle; uçtan uca inceleme (telif taraması dahil) | Bekçi | sonnet | K-06, K-07b |

## Faz 3 — Temizlik (uygulama mağazada olmadığı için Faz 2 ile paralel olabilir; sadece aynı dosyalara dokunanlar sırayla)

| # | İş | Kim | Model |
|---|---|---|---|
| K-09a | Migration: kitap tablolarını, `chat_sessions`, `bookmarks.book_id`, `book-files` deposunu kaldır; `delete-account` tablo listesi | Köprü | sonnet |
| K-09b | Tam metin içeren migration dosyalarının içeriğini "telif nedeniyle kaldırıldı" yorumuna indir (dosya adları kalır) | Köprü | haiku |
| K-09c | `ai-chat`, `ai-definition` function'larını sil (prod + repo) | Köprü | haiku |
| K-10 | Pipeline: kitap runner/lib, `data/highlights`, `data/pdf-curated`, `pdf-curated` kaynağı, çalışmayan `books:*` script'leri | Değirmen | haiku |
| K-11 | README/`docs/architecture.md` güncelleme (254 Lüzumsuz Bilgiler kartı yayında kalır — karar 3) | Atlas | — |

## Doğrulama (her faz sonu, Atlas)
`npm run typecheck` · `npm run lint` (LF kopyada) · `npm run test:unit` · `cd packages/pipeline && npm test` · `supabase/tests` PGlite · Maestro (misafir + hesap). Faz 0 sonrası: anon anahtarla REST'ten `book_sections` okunamadığını kendim denerim.

## Push / build
Her faz sonunda kullanıcıya sorulur. Mobil build sadece Faz 2 bitince ve kullanıcı isterse.
