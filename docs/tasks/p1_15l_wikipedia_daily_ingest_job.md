# P1-15l - Production Wikipedia Daily Ingest Job

## Amac

Release sonrasi Wikipedia kaynakli fact uretimini kucuk, olculebilir ve maliyet kontrollu bir is olarak calistirmak.

Hedef davranis:

- Gunluk yaklasik 10 yeni kaliteli fact.
- Haftalik toplam yaklasik 100 yeni fact.
- Groq rate/token limitine gelince temiz durma.
- Kalite guard'lari gevsetmeden ilerleme.

## Kapsam

Ana hedef dosyalar:

- `packages/pipeline/src/runners/run-all.js`
- `packages/pipeline/src/sources/wikipedia.js`
- `packages/pipeline/src/lib/groq.js`
- `packages/pipeline/src/lib/supabase.js`
- `packages/pipeline/src/lib/quality-policy.js`
- `packages/pipeline/src/lib/wiki-source-policy.js`

Dokumantasyon:

- `docs/roadmap_todo.md`
- `docs/tasks/p1_15l_wikipedia_daily_ingest_job.md`

## Kapsam Disi

- Kategori verisini DB'den kaldirmak.
- Feed kartinda kategori gosterimini geri getirmek.
- Hardcoded fallback source listelerine donmek.
- Buyuk `run-all` davranisini production cron'a tasimak.
- Admin CMS kurmak.

## Uygulama Plani

- [ ] Runner'a `--target-saved` parametresi ekle.
  - Ornek: `--target-saved 10`.
  - Job, kaydedilen fact sayisi hedefe ulasinca durmali.

- [ ] Runner'a `--max-candidates` parametresi ekle.
  - Ornek: `--max-candidates 40`.
  - Wikipedia source fetch tarafinda sonsuz aday arama yok.

- [ ] Runner'a `--max-groq` parametresi ekle.
  - Ornek: `--max-groq 20`.
  - Quality gate'e takilan adaylar Groq butcesini tamamen tuketmemeli.

- [ ] `stop_on_rate_limit` davranisini production default yap.
  - Groq 429 gorulunce job basarisiz gibi davranmak yerine temiz ozetle bitsin.
  - Exit code karari ayrica netlestirilsin: cron retry firtinasi yaratmayacak sekilde.

- [ ] Sadece Wikipedia lane'i calistiran script alias'i ekle.
  - Ornek: `npm run facts:wikipedia-daily`.
  - Varsayilanlar: `target_saved=10`, `max_candidates=40`, `max_groq=20`.

- [ ] Haftalik catch-up icin ayri alias veya parametre seti tanimla.
  - Ornek: `target_saved=50`, `max_candidates=160`, `max_groq=90`.

## Kabul Kriterleri

- Gunluk job tek komutla calisir.
- Job 10 kayit hedefini gorunce durur.
- Groq rate limit durumunda kontrollu durur ve ozet verir.
- Duplicate, quality reject ve Groq fail nedenleri run sonunda gorunur.
- `npm run typecheck` temiz gecer.
- Kucuk pilot: `target_saved=2`, `max_candidates=12`, `max_groq=5` ile dogrulanir.

## Notlar

- Kategori esitligi hedef degildir.
- Category DB'de kalmaya devam eder; FTUE, For You ve ranking icin gereklidir.
- Seed'ler discovery baslangic noktasi olarak kullanilir; feed urun kararini temsil etmez.
