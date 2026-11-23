# İçerik Hattı v2 — Uygulama planı

**Spec:** `docs/specs/content-pipeline-v2.md` · **Durum:** Onay bekliyor · **Tarih:** 2026-11-20

Her görev ayrı bir `board/tasks/V2-xx.md` kartı olur. Ajan işi bitirince testleri geçirir, yerel commit atar (push yok) ve `board/logs/V2-xx.md` raporunu yazar. Atlas sonucu doğrular.

## Faz 0 — Hazırlık (kullanıcı, ~15 dk)
| # | İş | Kim |
|---|---|---|
| F0-1 | Groq konsolunda free limitleri oku → Atlas'a ilet (`gpt-oss-120b`, `gpt-oss-20b`, `qwen3.8-27b`) | Kullanıcı |
| F0-2 | Cloudflare hesabı aç (ücretsiz), Workers AI API token'ı oluştur | Kullanıcı |
| F0-3 | GitHub repo secret'larına ekle: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (Groq ve Supabase secret'ları zaten var) | Kullanıcı |
| F0-4 | (İsteğe bağlı) Gemini AI Studio anahtarı → secret `GEMINI_API_KEY` (doğrulayıcı yedeği) | Kullanıcı |

## Faz 1 — Temel (paralel başlayabilir)
| # | Görev | Ajan | Bağımlılık | Bitti sayılır |
|---|---|---|---|---|
| V2-01 | DB migration: pgvector, `fact_candidates`, `pipeline_runs`, `facts` yeni kolonları + unique index'ler + HNSW + RLS; uygulama sorgusu sadece `published` | Köprü | — | Migration yerelde (`supabase db reset`) temiz çalışır; RLS testi: anon `fact_candidates` okuyamaz |
| V2-02 | LLM sağlayıcı katmanı: OpenAI-uyumlu tek arayüz, Groq/Cloudflare/Gemini adaptörleri, zincir + üstel bekleme + günlük bütçe sayacı; `pipeline.config.json` + README bölümü | Değirmen | — | Birim testler (sahte HTTP): 429'da yedeğe geçer, bütçe %90'da sağlayıcıyı bırakır, 404'te alarm olayı üretir |
| V2-03 | Tekrar önleme modülü (saf): normalize + hash, cosine eşik kararı, gri bölge yönlendirmesi | Usta | — | Birim testler: Türkçe "ı/İ" normalize, eşik sınırları, aynı konu-farklı olgu örnekleri |

## Faz 2 — Hat adımları
| # | Görev | Ajan | Bağımlılık | Bitti sayılır |
|---|---|---|---|---|
| V2-04 | Toplayıcılar: S1 HF arşivi tek seferlik içe aktarma, S2 günlük DYK, S3 TR BM, S4 misconceptions/unusual → `fact_candidates` | Değirmen | V2-01 | Dry-run modu: DB'ye yazmadan ilk 50 adayı JSON'a döker; `source_key` tekrarsız |
| V2-05 | Puanlayıcı + yazar + doğrulayıcı adımları (prompt'lar, JSON şemaları, durum geçişleri) | Değirmen | V2-02, V2-03 | Birim testler (sahte LLM): durum makinesi, red nedenleri; dry-run'da 20 aday uçtan uca |
| V2-06 | **30 kancalık kör Türkçe testi:** aynı 30 kanca, 2–3 aday yazar modelle; anonim karşılaştırma dosyası | Değirmen → **Kullanıcı puanlar** | V2-05 | Kullanıcı puanları sonrası yazar modeli config'te kesinleşir |
| V2-07 | Mevcut 713 kartın embedding backfill'i (script, dry-run + apply) | Değirmen | V2-01, V2-02 | Dry-run çıktısı; apply kullanıcı onayıyla |

## Faz 3 — Operasyon
| # | Görev | Ajan | Bağımlılık | Bitti sayılır |
|---|---|---|---|---|
| V2-08 | GitHub workflow'ları: yeni günlük ingest (cron), haftalık 10 kartlık örnek Issue, alarm Issue'ları, aylık keepalive; eski `facts-ingest.yml` devre dışı | Köprü | V2-04, V2-05 | `workflow_dispatch` ile elle tetiklenen dry-run yeşil; alarm Issue'su test modunda açılır |
| V2-09 | Yayın adımı: stoktan günlük N kart `published`, kategori kotası | Usta | V2-01 | Birim testler: kota, stok azken davranış |
| V2-10 | Uçtan uca kabul: 1 günlük gerçek run (prod DB'ye `queued`), sayılar + 20 kartlık örnek raporu; kod incelemesi | Bekçi | Hepsi | ≥100 kart `queued` **veya** darboğaz raporu; olgu hatası örneğinde 0; inceleme bulguları kapandı |

## Sıra
```
Faz 0 (kullanıcı) ─┐
V2-01 ─┬─► V2-04 ─┐
V2-02 ─┼─► V2-05 ─┼─► V2-06 (kullanıcı) ─► V2-08 ─► V2-10
V2-03 ─┘          │
V2-01+02 ─► V2-07 ┘   V2-01 ─► V2-09 ──────────────┘
```
- V2-01, V2-02 ve V2-03 farklı dosyalara dokunur, paralel çalışır.
- V2-04 ve V2-05 aynı paketin farklı modüllerindedir; dosya çakışması olmasın diye kartlarda klasör sınırı çizilir.

## Kurallar (her kartta tekrarlanır)
- Push yok, `main`'e birleştirme kullanıcı onayıyla.
- `.env*`, anahtarlar, `google-services.json`, telifli içerik dosyalarına dokunulmaz.
- Kullanıcının dev sunucusuna/portuna dokunulmaz.
- Prod DB'ye yazan her komut önce `--dry-run`. `--apply` sadece Atlas üzerinden kullanıcı onayıyla.
- LLM çağıran testler sahte (mock) sağlayıcıyla; gerçek çağrı sadece V2-06 ve V2-10'da.
