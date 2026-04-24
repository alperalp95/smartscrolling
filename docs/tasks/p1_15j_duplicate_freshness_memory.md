# P1-15j - Duplicate / Freshness Memory

## Amac

Fact pipeline'in ayni veya cok benzer kok konulari kisa araliklarla yeniden secmesini azaltmak.
Hedef, feed'de "her gun yeni bilgi" hissini korurken Groq token tuketimini de dusurmektir.

## Problem

Mevcut duplicate korumasi agirlikla:
- `source_url` duplicate
- ayni `title`

uzerinden calisiyor.

Bu, ayni konu farkli basliklarla tekrar secildiginde yeterli degil.
Ozellikle Wikipedia / Stanford / MedlinePlus gibi kaynaklarda:
- ayni root topic
- yakin kavram
- benzer proper noun

farkli phrasing ile tekrar gelebiliyor.

## Ilk Slice Karari

Ilk dilimde migration acmadan, pipeline preflight katmaninda hafif bir `topic fingerprint` stratejisi uygulanacak.

Kural:
- son `60` gundeki ayni kategorideki fact basliklari okunur
- normalize edilmis token overlap ile benzerlik olculur
- benzerlik yuksekse aday Groq'a gitmeden once skip edilir

Bu slice:
- cheap
- migration'siz
- Groq limiti koruyan
- sonraki tam freshness system'i icin temel

## Uygulanan Davranis

- `duplicate-policy.js`
  - `findRecentTopicDuplicate()` helper'i eklendi
  - title normalization + lightweight token overlap ile benzer topic araniyor
- `supabase.js`
  - `findRecentTopicPreflight()` helper'i eklendi
  - insert sonrasi da `duplicate_recent_topic` korumasi var
- `run-all.js`
  - Wikipedia / Stanford / MedlinePlus / NASA akislari Groq oncesi recent topic preflight kullanir
  - yeni stat: `duplicate_recent_topic`

## Bilincli Sinirlar

- Bu ilk slice semantic duplicate cozmez
- `source_title` verisi facts tablosunda saklanmadigi icin benzerlik title tabanli calisir
- topic memory su an kategori-ici calisir; cross-category topic tekrarlarini engellemez

## Sonraki Slice Adaylari

1. `topic_registry` modeli
2. `canonical_topic_slug`
3. cross-category topic memory
4. freshness score ile ranking
5. son 30/60/90 gun feed topic dagilimi raporu
