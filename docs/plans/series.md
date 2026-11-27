# Seriler — Uygulama Planı

> **Ajanlar için:** Atlas her görevi `board/tasks/SE-0N.md` kartıyla verir; ajan yalnız kendi görevini görür. Adımlar `- [ ]`.

**Amaç:** Vikipedi seçkin/kaliteli maddelerini LLM'siz, kesintisiz kartlara bölüp yeni "Seriler" sekmesinde okutmak; 5–10 seri ücretsiz, diğerleri premium (ilk 3 kart önizleme).
**Mimari:** Ayrı tablolar (`series`, `series_cards`, `series_progress`) + RLS premium kilidi; pipeline'da saf bölme modülü ve iki betik (aday listesi, içe aktarma); mobilde veri katmanı, sekme (A), kapak sayfası, okuma (R2).
**Teknoloji:** Supabase (Postgres, RLS, PGlite testleri), Node pipeline (node:test, Biome), Expo SDK 54 / expo-router 6 / FlashList / jest-expo.
**Spec:** `docs/specs/series.md` (onaylandı 2026-11-27). Taslak: scratchpad `series-mockup/seriler-taslak.html` (A + R2 + kilit).

## Genel kısıtlar
- Seri verisi `facts`'e dokunmaz; akış, tekrar kontrolü, içerik hattı değişmez.
- Metin kaynaktan aynen; özet/LLM yok. Kart en çok `maxChars` (varsayılan 600) karakter, cümle sonunda bölünür.
- Premium kilidi RLS'te: `is_free OR position <= 3 OR (auth.jwt()->'app_metadata'->>'premium')::boolean`. Önizleme sayısı (3) tek bir SQL sabitinde + mobil ayarında; ikisi aynı.
- Kapak yalnız Commons (`thumb.wikimedia.org/wikipedia/commons/` veya `upload.wikimedia.org/wikipedia/commons/`); yoksa `null`.
- Kategoriler `facts` ile aynı metinler (ör. `📜 TARİH`).
- UI değerleri yalnız temadan; metinler Türkçe, büyük harf `toLocaleUpperCase('tr-TR')`. Yeni yerel paket yok.
- Kullanıcıya dönük ayarlar açıklamalı dosyada + README.
- Komutlar: mobil `npm run typecheck`, `npm run test:unit`; pipeline `cd packages/pipeline && npm test`; DB `node --test supabase/tests/series.test.mjs`; `npx biome check <dosyalar>`. Commit `git -c core.autocrlf=false`; push/merge yok.
- Worktree node_modules: kök → `C:\ss\node_modules`, `apps\mobile` → `C:\ss\apps\mobile\node_modules` (iki junction, PowerShell `cmd /c mklink /J`; kaldırma yalnız `cmd /c rmdir`).

## İnceleme odağı
1. Çok uzun madde (40K+ karakter, 60+ kart) → bölme hatasız, okuma ekranı akıcı (FlashList), ilerleme doğru. (SE-02, SE-07)
2. Premium olmayan kullanıcı/misafir 4. kartı API'den isterse boş döner; uygulama kilit kartını gösterir, çökmez. (SE-01, SE-07)
3. Satın aldıktan hemen sonra seri açılır (oturum yenilenir). (SE-07)
4. Misafir okur, sonra giriş yapar → ilerleme kaybolmaz (ileri olan kazanır). (SE-04)
5. Hiç seri yok / ağ hatası → sekmede boş/hata durumu, yeniden dene. (SE-05)

## Dosya haritası
| Dosya | Sorumluluk | Görev |
|---|---|---|
| `supabase/migrations/<ts>_series.sql`, `supabase/tests/series.test.mjs` | Tablolar, RLS, `replace_series_cards` | SE-01 |
| `packages/pipeline/src/series/split.js`, `.../wiki-sections.js`, testleri | Saf: düz metni bölümlere ayır, at, kartlara böl | SE-02 |
| `packages/pipeline/config/series.json`, `src/runners/series-candidates.js`, `src/runners/series-import.js`, README | Editör akışı | SE-03 |
| `apps/mobile/src/lib/series.ts`, `src/config/series.ts`, testleri | Veri katmanı + ilerleme (misafir/sunucu/birleştirme) | SE-04 |
| `app/(tabs)/series.tsx`, `components/ui/tab-bar.tsx`, `components/series/series-hero.tsx`, `components/series/series-shelf.tsx` | Sekme (A) | SE-05 |
| `app/series/[slug].tsx` | Kapak sayfası | SE-06 |
| `app/series/[slug]/read.tsx`, `components/series/series-card.tsx`, `app/premium.tsx` (avantaj + oturum yenileme) | Okuma (R2) + kilit | SE-07 |

Sıra: **SE-01 ∥ SE-02** → **SE-03 ∥ SE-04** → **SE-05** → **SE-06** → **SE-07** → Bekçi → Atlas: migration canlıya (kullanıcı onayı), 3 seri içe aktarma, emülatör.

---

### SE-01: Veritabanı (Köprü, sonnet)
**Dosyalar:** `supabase/migrations/<YYYYMMDDHHMMSS>_series.sql`, `supabase/tests/series.test.mjs` (mevcut `card_ask_foundation.test.mjs` PGlite kalıbı: anon/authenticated/service_role rolleri, `request.jwt.claim.sub`; JWT `app_metadata` için `request.jwt.claims` ayarı + `auth.jwt()` taklidi).
**Üretir:**
- `series` (spec §8 kolonları + `sections jsonb not null default '[]'`), `series_cards`, `series_progress`; indeksler: `series(status, published_at desc)`, `series_cards(series_id, position)`.
- RLS spec §8; önizleme sabiti `public.series_preview_cards()` → `3` (immutable SQL fonksiyonu).
- `public.replace_series_cards(p_series_id uuid, p_cards jsonb) returns void` — tek işlemde siler/ekler, `card_count`/`updated_at` günceller, ilerlemeyi `least(last_position, yeni_kart_sayısı)`'ya kırpar; yalnız `service_role` çalıştırır (`revoke ... from public, anon, authenticated`).
- [ ] Test: anon `draft` seriyi görmez; `published` görür.
- [ ] Test: anon ücretsiz serinin tüm kartlarını, premium serinin 1–3'ünü okur, 4'ü 0 satır.
- [ ] Test: `app_metadata.premium=true` olan authenticated tüm kartları okur; `false` olan 1–3.
- [ ] Test: kullanıcı yalnız kendi `series_progress` satırını okur/yazar; başkasınınkini göremez.
- [ ] Test: `replace_series_cards` anon/authenticated için yetki hatası; service role ile kart sayısı ve ilerleme kırpması doğru.
- [ ] Commit `feat(db): series tables, RLS premium preview, replace_series_cards`. Canlıya uygulama YOK (Atlas, kullanıcı onayıyla).

### SE-02: Bölme modülü (Usta, sonnet)
**Dosyalar:** `packages/pipeline/src/series/wiki-sections.js`, `packages/pipeline/src/series/split.js`, `packages/pipeline/src/series/__tests__/split.test.js`
**Üretir:**
- `parseWikiExtract(text: string, title: string): Array<{ heading: string, text: string }>` — `exsectionformat=wiki` düz metni (`== Başlık ==`, `=== Alt ===`) bölümlere ayırır; ilk bölüm başlığı = `title`; alt bölümler kendi başlığıyla ayrı bölüm.
- `EXCLUDED_SECTIONS` (normalize, küçük harf): kaynakça, kaynaklar, notlar, dipnotlar, dış bağlantılar, ayrıca bakınız, ileri okuma, bibliyografya, galeri. Boş bölümler atılır.
- `filterSections(sections, wanted: string[] | null)` — `null` = hepsi (hariçler hariç); liste = yalnız o başlıklar ve alt bölümleri.
- `splitIntoCards(sections, { maxChars = 600 } = {}): Array<{ position: number, sectionTitle: string, body: string }>` — position 1'den; cümle sonunda böler (Türkçe kısaltmalarda yanlış bölmemek için `Dr.`, `vb.`, `yy.`, `M.Ö.`, `M.S.`, sayı+nokta istisnaları); tek cümle > maxChars ise kelime sınırında böler.
- `summarizeSections(cards): Array<{ title, firstPosition, cardCount }>`.
- [ ] Test: kartlar birleşince (boşluk normalize) seçilen bölümlerin metni birebir.
- [ ] Test: hiçbir kart `maxChars`'ı aşmaz; uzun tek cümle bölünür, kelime kaybolmaz.
- [ ] Test: "M.Ö. 330" ve "1. Dünya Savaşı" ortasından bölünmez.
- [ ] Test: Kaynakça/Dış bağlantılar atılır; `wanted` filtresi alt bölümleri kapsar.
- [ ] Test (odak 1): 40K karakterlik sentetik metin → kart sayısı ≈ toplam/maxChars, pozisyonlar ardışık.
- [ ] Commit `feat(pipeline): wiki section parser and series card splitter`.

### SE-03: Editör betikleri (Değirmen, sonnet)
**Dosyalar:** `packages/pipeline/config/series.json` (açıklamalı, örnek 3 madde: biri `free:true`), `src/runners/series-candidates.js`, `src/runners/series-import.js`, `packages/pipeline/README.md` (Seriler bölümü) + `src/runners/__tests__/series-import.test.js`
**Tüketir:** SE-02 fonksiyonları; SE-01 tablo/fonksiyon adları; `src/lib/supabase.js` istemcisi; MediaWiki API (User-Agent: mevcut sabit).
**Üretir:**
- `series-candidates` — `Kategori:Seçkin maddeler` + `Kategori:Kaliteli maddeler` üyeleri; her biri için karakter sayısı, tahmini kart sayısı, Commons kapak var mı → `.cache/series-candidates.json` + konsolda özet. Ağ dışında yan etki yok.
- `series-import [--apply] [--publish <slug>|--publish-all]` — `series.json` doğrulanır (bilinmeyen alan/eksik başlık/kategori listede yok → hata); her madde: `extracts` (+`revid`) + `pageimages` (`pilicense=free`, sadece Commons kabul) → SE-02 → önizleme `.cache/series-<slug>.json`; `--apply`: `series` upsert (slug = başlığın Türkçe-uyumlu küçük harf kısa hali), `replace_series_cards` RPC, `sections` yazılır, `status='draft'`; `--publish` ilgili seriyi `published`.
- [ ] Test: config doğrulama hataları; slug üretimi (`Galata Kulesi` → `galata-kulesi`, `İbn Haldun` → `ibn-haldun`).
- [ ] Test: sahte HTTP + sahte Supabase ile içe aktarma: yerel `wikipedia/tr/` görseli → `cover_url null`; Commons → kabul; RPC'ye giden kart JSON'u SE-02 çıktısıyla aynı.
- [ ] Commit `feat(pipeline): series candidates and import runners`.

### SE-04: Mobil veri katmanı (Usta, sonnet)
**Dosyalar:** `apps/mobile/src/lib/series.ts`, `apps/mobile/src/config/series.ts` (`SERIES_CONFIG = { previewCards: 3 }`, açıklamalı), `apps/mobile/src/lib/__tests__/series.test.ts` (+ gerekirse `src/types/index.ts` tipleri)
**Üretir:**
- Tipler: `SeriesSummary { id, slug, title, summary, category, coverUrl, cardCount, sectionCount, isFree, isFeatured, publishedAt }`, `SeriesSection { title, firstPosition, cardCount }`, `SeriesDetail = SeriesSummary & { sections, sourceTitle, sourceUrl, license }`, `SeriesCard { position, sectionTitle, body }`, `SeriesProgress { seriesId, lastPosition, completedAt }`.
- `fetchSeriesList(): Promise<SeriesSummary[]>`, `fetchSeriesBySlug(slug): Promise<SeriesDetail | null>`, `fetchSeriesCards(seriesId, from = 1, to?): Promise<SeriesCard[]>` (RLS ne veriyorsa).
- `getProgress(seriesId, userId | null)`, `saveProgress(seriesId, position, cardCount, userId | null)` — misafir AsyncStorage (`series.progress.v1`), girişli `series_progress` upsert; son kartta `completedAt`.
- `mergeGuestProgress(userId): Promise<void>` — cihazdakileri sunucuya; çakışmada büyük pozisyon; başarıdan sonra cihaz kaydı silinir. `_layout.tsx` oturum açılışında çağrısı SE-07'de bağlanır.
- `groupForShelves(list): { featured: SeriesSummary | null, byCategory: Array<{ category, items }> }` — featured = `isFeatured` ilk, yoksa en yeni.
- [ ] Testler (Supabase sahte): liste/slug eşleme; misafir kaydet-oku; giriş sonrası birleştirme (odak 4: sunucuda 5, cihazda 12 → 12; sunucuda 20, cihazda 12 → 20); `groupForShelves` kategorisiz/boş liste.
- [ ] Commit `feat(mobile): series data layer and progress`.

### SE-05: Seriler sekmesi — A (Fırça, sonnet)
**Dosyalar:** `apps/mobile/app/(tabs)/series.tsx`, `apps/mobile/app/(tabs)/_layout.tsx` (yeni `Tabs.Screen name="series"` Akış ile Profil arasında), `apps/mobile/components/ui/tab-bar.tsx` (`series: { on: 'albums', off: 'albums-outline', label: 'Seriler' }`), `apps/mobile/components/series/series-hero.tsx`, `apps/mobile/components/series/series-shelf.tsx` + testleri.
**Tüketir:** SE-04 `fetchSeriesList`, `groupForShelves`, `getProgress`.
- Yerleşim taslak A: başlık "Seriler" (TopBar), öne çıkan (hero), "Devam et" (yalnız varsa), kategori rafları (yatay). Dokununca `/series/<slug>`.
- testID: `series-tab`, `series-hero`, `series-continue`, `series-shelf-<kategori>`, `series-item-<slug>`, `series-empty`, `series-error`.
- [ ] Test: hero + raflar listeden doğru çizilir; premium seride `PREMIUM` çipi; boş liste → "Yakında"; hata → yeniden dene düğmesi (odak 5).
- [ ] Commit `feat(mobile): series tab (featured, continue, shelves)`.

### SE-06: Seri kapak sayfası (Fırça, sonnet)
**Dosyalar:** `apps/mobile/app/series/[slug].tsx`, `apps/mobile/app/_layout.tsx` (Stack.Screen `series/[slug]`), testi.
**Tüketir:** SE-04 `fetchSeriesBySlug`, `getProgress`; authStore `hasPremium`.
- Taslak kapak sayfası: kapak (Media; yoksa marka degradesi), meta (kategori · "Vikipedi seçkin/kaliteli madde" ayrımı gerekmez → "Vikipedi"), başlık, `StatBlock` ×3 (kart, ~dk, bölüm), özet, bölüm listesi (`sections`; premium değilse ve seri premium ise `firstPosition > 3` olanlar soluk + kilit), düğme "Okumaya başla" / "Devam et (12/31)" → `/series/<slug>/read?from=<pos>`, kaynak satırı (link).
- testID: `series-cover`, `series-start`, `series-section-<n>`.
- [ ] Test: ilerleme varsa düğme metni "Devam et (12/31)"; premium olmayanda kilitli bölümler; kaynak satırı.
- [ ] Commit `feat(mobile): series cover page`.

### SE-07: Okuma (R2) + kilit + premium (Fırça, sonnet)
**Dosyalar:** `apps/mobile/app/series/[slug]/read.tsx`, `apps/mobile/components/series/series-card.tsx`, `apps/mobile/app/premium.tsx` (avantaj "Tüm seriler" + satın alma/geri yükleme başarısında `supabase.auth.refreshSession()`), `apps/mobile/app/_layout.tsx` (oturum açılınca `mergeGuestProgress`) + testler.
**Tüketir:** SE-04; `PremiumUpsellCard`.
- Akış gibi dikey sayfalı `FlashList` (`pagingEnabled`), otomatik ilerleme YOK. Üstte "Seri · n / N" + ✕. İlk kartta kapak görseli; kartlar akış kartı yazı stilleriyle (meta = bölüm başlığı, başlık, gövde, küçük kaynak satırı). Sayfa değişince `saveProgress`.
- Kilit: premium seri + premium değil → 3. karttan sonra tek bir kilit sayfası (bulanık önizleme yerine akıştaki `PremiumUpsellCard`: başlık "Serinin devamı Premium'da", gövde "<N−3> kart daha · tüm seriler, reklamsız akış", düğme → `/premium`). Kullanıcı premium görünürken 4. kart boş gelirse bir kez `refreshSession` + yeniden çek (odak 2–3).
- testID: `series-reader`, `series-card-<n>`, `series-lock`.
- [ ] Test: kart sırası/pozisyon göstergesi; sayfa değişiminde `saveProgress`; premium değil → kilit sayfası, 4+ kart çizilmez; boş 4. kart + `hasPremium=true` → `refreshSession` bir kez.
- [ ] Test: premium.tsx satın alma başarısında `refreshSession` çağrılır.
- [ ] Commit `feat(mobile): series reader with premium preview lock`.

### Arayüz kontrol listesi (SE-05/06/07)
Seri ekranları "ekran" türüne karşı — referans: sekme için `app/(tabs)/profile.tsx`, kapak/okuma için `app/fact/[id].tsx` ve `components/feed/fact-post.tsx`; okundu 2026-11-27. Yerleşim: kullanıcının seçtiği taslak (A + R2 + kilit).
- [ ] ekran kabı — paylaşılan `Screen` (5 ekranda: profile, fact/[id], premium, saved, settings); okuma ekranı akış gibi tam ekran (`Screen` yok, akış kalıbı)
- [ ] üst bar — paylaşılan `TopBar` (4 ekranda); okuma ekranında "Seri · n / N" + ✕
- [ ] görseller — paylaşılan `Media` (4 dosya); kapak yoksa marka degradesi `LinearGradient` + `colors.brandGradient`; doğrudan `expo-image` yazılmaz
- [ ] kategori/bölüm başlığı — `GradientText` + `type.meta`, metin `toLocaleUpperCase('tr-TR')` (3 dosya)
- [ ] başlık / gövde — `type.cardTitle` + `colors.text`, `type.body` + `colors.text` (fact-post, detay)
- [ ] sayılar (kart / dk / bölüm) — paylaşılan `StatBlock` (profile, feed-top-bar)
- [ ] ana düğme — `GradientButton` (10 dosya); "Okumaya başla"/"Devam et (n/N)"
- [ ] PREMIUM çipi / kategori çipi — paylaşılan `Chip` ya da `GradientButton` `pill` (gradient.tsx `pill`); yeni çip yazılmaz
- [ ] kilit — paylaşılan `PremiumUpsellCard` (akıştaki), yeni kilit kartı yazılmaz
- [ ] ilerleme çizgisi — fact-post'taki ilerleme çizgisi kalıbı (yükseklik sabiti `PROGRESS_LINE_HEIGHT`), renk `brandGradient`
- [ ] boşluk/köşe — yalnız `space.*`, `radius.*`; kapak köşesi `radius.lg` (3/3)
- [ ] fact-post'tan KOPYALANMAZ: okuma sayacı/otomatik ilerleme, beğen/sor/paylaş/kaydet aksiyonları, "devamı" ölçümü
(Aramalar: `ui/screen'`, `ui/top-bar'`, `ui/media'`, `ui/stat-block'`, `ui/chip'`, `premium-upsell-card'`, `GradientButton` — app + components.)

### Kabul (Bekçi + Atlas)
- Bekçi (sonnet): SE-01..07 diff + kontrol listesi.
- Atlas: migration canlıya (**kullanıcı onayı**), `series-import` ile 3 seri (1 ücretsiz, 2 premium) `--apply --publish`, emülatörde sekme → kapak → okuma → kilit; ekranlar `board/screens/se-*`.
