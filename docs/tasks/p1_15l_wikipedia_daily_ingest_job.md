# P1-15l - Production Wikipedia Daily Ingest Job

## Amac

Release sonrasi Wikipedia kaynakli fact uretimini kucuk, olculebilir ve maliyet kontrollu bir is olarak calistirmak.

Hedef davranis:

- Gunluk sabah/aksam 15'er kayit hedefiyle yaklasik 30 yeni kaliteli fact.
- Haftalik toplam en az 100 yeni fact floor'u.
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
- `.github/workflows/facts-ingest.yml`

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

- [x] Runner'a `--target-saved` parametresi ekle.
  - Ornek: `--target-saved 15`.
  - Job, kaydedilen fact sayisi hedefe ulasinca durmali.

- [x] Runner'a `--max-candidates` parametresi ekle.
  - Ornek: `--max-candidates 90`.
  - Wikipedia source fetch tarafinda sonsuz aday arama yok.

- [x] Runner'a `--max-groq` parametresi ekle.
  - Ornek: `--max-groq 45`.
  - Quality gate'e takilan adaylar Groq butcesini tamamen tuketmemeli.

- [x] `stop_on_rate_limit` davranisini production default yap.
  - Groq 429 gorulunce job basarisiz gibi davranmak yerine temiz ozetle bitsin.
  - Exit code retry firtinasi yaratmayacak sekilde temiz ozetle tamamlanir.

- [x] Sadece Wikipedia lane'i calistiran script alias'i ekle.
  - Ornek: `npm run facts:wikipedia-daily`.
  - Varsayilanlar: `target_saved=15`, `max_candidates=90`, `max_groq=45`.

- [x] Haftalik catch-up icin ayri alias veya parametre seti tanimla.
  - Ornek: `target_saved=50`, `max_candidates=160`, `max_groq=90`.

- [x] GitHub Actions schedule ekle.
  - Gunluk job: 05:00 ve 17:00 UTC (08:00 ve 20:00 Europe/Istanbul).
  - Haftalik catch-up check: Pazar 06:00 UTC.
  - Manuel `workflow_dispatch` ile `daily` veya `catchup` calistirilabilir.

- [x] Haftalik floor check ekle.
  - Son 7 gunde 100 kayit altindaysa catch-up kosar.
  - Floor saglandiysa catch-up Groq harcamadan pas gecer.

## Kabul Kriterleri

- Gunluk job tek komutla calisir: `npm run facts:wikipedia-daily`.
- Job 15 kayit hedefini gorunce durur.
- Groq rate limit durumunda kontrollu durur ve ozet verir.
- Duplicate, quality reject ve Groq fail nedenleri run sonunda gorunur.
- GitHub Actions cron production secret'lariyla calisacak sekilde tanimlidir.
- `npm run typecheck` temiz gecer.
- Kucuk pilot: `npm run facts:run-all -- --wikipedia-count 2 --target-saved 2 --max-candidates 12 --max-groq 5 --stanford-count 0 --medlineplus-count 0 --nasa-count 0` ile dogrulanir.

## Notlar

- Kategori esitligi hedef degildir.
- Category DB'de kalmaya devam eder; FTUE, For You ve ranking icin gereklidir.
- Seed'ler discovery baslangic noktasi olarak kullanilir; feed urun kararini temsil etmez.
