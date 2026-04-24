# P1-15k - PDF Curated Source Lane

## Amac

Wikipedia / MedlinePlus / NASA / Stanford hattini bozmadan,
kitap veya PDF tabanli curated Turkce kaynaklari ayni fact pipeline'ina baglamak.

Ilk hedef kaynak:
- `Luzumsuz Bilgiler Ansiklopedisi`

## Neden Ayrı Lane?

Bu kaynaklar:
- discovery problemi tasimaz
- madde / soru bazli gelir
- zaten populer-bilim / merak uyandirici tona daha yakindir

Bu nedenle:
- source extraction farkli
- ama `Groq rewrite + quality gate + insert` ortak kalmali

## Ilk Slice

Ilk dilimde PDF parse eklenmedi.
Bunun yerine:
- kullanicidan gelen madde metinleri JSON dosyasina yazilir
- `pdf-curated` source lane bu JSON'u okur
- her maddeyi source article gibi fact pipeline'ina verir

## Eklenenler

- `packages/pipeline/data/pdf-curated/luzumsuz-bilgiler-1.sample.json`
- `packages/pipeline/src/sources/pdf-curated.js`
- `packages/pipeline/src/runners/pdf-curated.js`
- `packages/pipeline/package.json` icine `run:pdf-curated`
- `run-all.js` icine opsiyonel `--pdf-curated-count` ve `--pdf-curated-file`
- `groq.js` icine `pdf_curated` source guidance

## Ornek Kullanim

Sadece curated PDF lane:

```powershell
npm --workspace @smartscrolling/pipeline run run:pdf-curated -- --count 2
```

Belirli dosya ile:

```powershell
npm --workspace @smartscrolling/pipeline run run:pdf-curated -- --count 10 --file "C:\path\to\entries.json"
```

Tum pipeline icinde opsiyonel:

```powershell
npm run facts:run-all -- --wikipedia-count 10 --pdf-curated-count 5 --pdf-curated-file "C:\path\to\entries.json"
```

## Sonraki Slice Adaylari

1. PDF text extraction helper
2. soru / madde bazli otomatik split
3. sayfa numarasi ve bolum referansi metadata'si
4. source-specific visual/fallback dili
5. curated PDF lane icin farkli quality threshold
