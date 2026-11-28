# Seriler v2 — Uygulama Planı

**Spec:** `docs/specs/series-v2.md` · **Taslak:** scratchpad `series-mockup/seriler-taslak-2.html` · **Entegrasyon dalı:** `feat/series-v2` (main'den).

## Genel kısıtlar
- Değerler yalnız temadan; yeni değer temaya açıklamalı giriş (`type.reading` 17/27 dahil). Türkçe metin; `toLocaleUpperCase('tr-TR')`.
- Paylaşılan parçalar: `Media`, `GradientText`, `GradientButton`, `Chip`, `TopBar`, `Screen`, `StatBlock`; zemin ışıkları `expo-linear-gradient` (paylaşım görseli `components/share/share-card.tsx` kalıbı).
- Yeni paket yok, gerçek ağ yok. Mobil: `npm run typecheck`, `npx jest --runInBand`, `npx biome check <dosyalar>`.
- Worktree: kökte `cmd /c mklink /J node_modules C:\ss\node_modules`, `apps\mobile` içinde `cmd /c mklink /J node_modules C:\ss\apps\mobile\node_modules`; bitince yalnız `cmd /c rmdir`.
- Commit `git -c core.autocrlf=false`, son satır `Co-Authored-By: Claude <model> <noreply@anthropic.com>`; push/merge yok.

## İnceleme odağı
1. Çok kısa ve çok uzun kartlarda kart yüksekliği aynı, metin taşmıyor (600 karakter 17/27 ile sığar).
2. Akışta reklam yuvası ve tanıtım aynı noktaya düşerse ikisi de görünür, sıra bozulmaz.
3. Tüm seriler görülmüş/tamamlanmışsa akış tanıtımsız devam eder, çökmez.
4. Misafir ↔ girişli ilerleme kaynağı (AsyncStorage / tablo) tanıtım ve Tamamlandı'da doğru kullanılır.
5. Premium kullanıcıya PREMIUM çipi ve "İlk 3 kart" metni gösterilmez.

## Görevler ve sıra
`SV-01 (okuma) ∥ SV-02 (mantık)` → `SV-03 (sekme/kapak) ∥ SV-04 (akış kartı)` → Bekçi → emülatör.

### SV-01 — Okuma kartı (Fırça, sonnet)
Dosyalar: `apps/mobile/app/series/[slug]/read.tsx`, `apps/mobile/components/series/series-card.tsx`, `apps/mobile/src/theme/typography.ts` (`type.reading`), testleri.
- Spec §2 birebir. `SeriesCard` yeni prop'lar: `sectionIndex: number`, `sectionCount: number` (bölüm içi n/m), `nextSectionTitle: string | null` (yalnız bölümün son kartında dolu). Hesap okuma ekranında `sections` (`{title, firstPosition, cardCount}`) üzerinden.
- Kart yüksekliği: sayfa yüksekliğinden üst bar ve alt boşluk çıkarılarak sabit; içerik `flex` ile, kaynak satırı en altta.
- Testler: n/m metni (1/1 yazılmaz); son kartta "Sonraki bölüm" + başlık, son bölümde yok; ilk kartta kapak; gövde `type.reading` (fontSize 17).
- Commit `feat(mobile): series reader card layout with section progress`.

### SV-02 — Mantık: ilerleme haritası, öneri, akış tanıtım yerleştirme (Usta, sonnet)
Dosyalar: `apps/mobile/src/lib/series.ts` (ekleme), `apps/mobile/src/lib/seriesTeaser.ts` (yeni), `apps/mobile/src/config/seriesTeaser.ts` (yeni, açıklamalı), testleri.
Üretir:
- `getAllProgress(userId: string | null): Promise<Record<string, SeriesProgress>>` — misafir AsyncStorage haritası, girişli `series_progress` tek sorgu.
- `pickNextSeries(list: SeriesSummary[], current: SeriesSummary, progress: Record<string, SeriesProgress>): SeriesSummary | null` — spec §3 sırası.
- `SERIES_TEASER_CONFIG = { firstAfter: 8, interval: 12, alternate: true }`.
- `export type FeedSeriesSlot = { id: string; slotType: 'series'; series: SeriesSummary; mode: 'teaser' | 'continue'; lastPosition: number }`.
- `planSeriesTeasers(list, progress, seenIds: string[], config): FeedSeriesSlot[]` — sıralı tanıtım kuyruğu: önce kaldığın yerden (tamamlanmamış, ilerleme > 0, en son güncellenen), sonra görülmemiş + tamamlanmamış seriler, `alternate` ise ücretsiz/premium dönüşümlü; her seri en çok 1.
- `insertSeriesSlots<T extends {id:string}>(items: Array<T | {slotType:string}>, slots: FeedSeriesSlot[], config): Array<…>` — içerik kartı sayısına göre (reklam yuvaları sayılmaz) `firstAfter` sonra her `interval`'de bir; reklam yuvasının hemen arkasına denk gelirse bir sonraki içerik kartından sonra; kuyruk bitince durur.
- `loadSeenSeriesTeasers(): Promise<string[]>`, `markSeriesTeaserSeen(seriesId): Promise<void>` — AsyncStorage `feed.seenSeriesTeasers.v1`.
- Testler: odak 2–4 + bir kez + dönüşüm + tamamlanan hariç + kaldığın yerden önce + kuyruk bitişi + `pickNextSeries` + `getAllProgress` (misafir/girişli sahte).
- Commit `feat(mobile): series progress map, next suggestion, feed teaser planning`.

### SV-03 — Sekme ve kapak: Tamamlandı, ilerleme, Baştan oku, öneri (Fırça, sonnet)
Dosyalar: `apps/mobile/app/(tabs)/series.tsx`, `apps/mobile/components/series/series-shelf.tsx`, `apps/mobile/components/series/series-hero.tsx`, `apps/mobile/app/series/[slug].tsx`, testleri.
Tüketir: SV-02 `getAllProgress`, `pickNextSeries`.
- Spec §3 birebir. Çip "✓ Tamamlandı" (`colors.success` metin + `success` %18 zemin → temaya açıklamalı giriş `successSoft` gerekirse). Raf kapağının altında ilerleme çizgisi + "n / N kart". "Devam et" tamamlananları içermez.
- testID: `series-done-<slug>`, `series-progress-<slug>`, `series-restart`, `series-next-<slug>`.
- Commit `feat(mobile): series completed badge, shelf progress, restart and next suggestion`.

### SV-04 — Akış seri tanıtım kartı (Fırça, sonnet)
Dosyalar: `apps/mobile/components/feed/series-teaser-card.tsx` (yeni), `apps/mobile/app/(tabs)/index.tsx` (FeedListItem birliği, `insertSeriesSlots`, renderItem, görüldü işareti), testleri.
Tüketir: SV-02 `planSeriesTeasers`, `insertSeriesSlots`, `loadSeenSeriesTeasers`, `markSeriesTeaserSeen`, `getAllProgress`, `fetchSeriesList`; `useAuthStore` `hasPremium`.
- Spec §4 birebir; kart `FeedAdCard` gibi sayfa yüksekliğinde, otomatik geçmez (`onNext` yok; kaydırınca geçer). Kart ekranda etkin olunca `markSeriesTeaserSeen`. Seri listesi akış yüklenirken bir kez çekilir; hata olursa tanıtımsız devam.
- testID: `feed-series-teaser-<slug>`, `feed-series-cta`.
- Testler: ücretsiz/premium/premium-kullanıcı/kaldığın yerden metinleri ve yönlendirme yolu; liste hatasında akış normal; tanıtım etkin olunca görüldü işaretlenir.
- Commit `feat(mobile): series teaser cards in feed`.

### Kabul
Bekçi (sonnet) inceleme → Atlas emülatör (okuma, sekme, kapak, akış kartı) → kullanıcı onayıyla main + push.
