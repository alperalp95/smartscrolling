# P6-14 Lint ve Typecheck Recovery

## Amac

- Release oncesi kalite kapilarini tekrar yesile cekmek.
- `npm run lint`, `npm run typecheck` ve `npm run check:edge-functions` durumunu netlestirmek.
- Isleri kucuk, onayli ve task disi kodlara dokunmadan ilerletmek.

## Kurallar

- Over-engineering yok.
- Refactoring yok.
- Task disi dosyalara dokunulmayacak.
- Her alt task kullanici onayi alindiktan sonra yapilacak.
- Her alt task sonunda yapilan is ve dogrulama sonucu raporlanacak.
- Git push yalnizca kullanici ayrica onaylarsa yapilacak.

## Mevcut Baslangic Durumu

- `npm run typecheck` geciyor.
- `npm run check:edge-functions` geciyor.
- `npm run lint` gecmiyor; Biome 59 hata raporluyor.
- Ilk gorunen hata siniflari:
  - format / line-ending farklari
  - `useEffect` dependency uyarilari
  - hedefli bakilmasi gereken Biome correctness uyarilari

## Alt Tasklar

- [x] Task dosyasini ac ve changelog baslangic notunu ekle.
- [x] Format / line-ending kaynakli lint hatalarini kucuk kapsamla duzelt.
- [x] `useEffect` dependency lint hatalarini davranis degistirmeden duzelt.
- [x] Import siralama lint hatalarini davranis degistirmeden duzelt.
- [x] Kalan Biome correctness / suspicious uyarilarini kucuk kapsamla duzelt.
- [x] `npm run lint`, `npm run typecheck` ve `npm run check:edge-functions` final dogrulamasini yap.
- [x] Sonuclari bu task dosyasina ve changelog'a isle.

## Kapsam Disi

- Yeni ozellik eklemek.
- Mevcut mimariyi refactor etmek.
- Lint ile ilgisi olmayan UI, auth, feed, reader veya pipeline davranislarini degistirmek.
- Toplu otomatik format ile gereksiz dosya churn'u yapmak.

## Task Log

### 2026-05-05 - Baslangic

- Task dosyasi acildi.
- Baslangic kalite durumu kayda alindi.
- Sonraki adim icin sadece format / line-ending kaynakli lint hatalari ayrildi.

### 2026-05-05 - Format / Line-ending Duzeltmesi

- Biome'un `format` olarak isaretledigi 45 dosyada hedefli `biome format --write` calistirildi.
- Davranis degisikligi, refactor veya lint disi kod degisikligi yapilmadi.
- Format diagnostigi kalmadi.
- `npm run lint` 59 hatadan 14 format-disi hataya indi.
- `npm run typecheck` gecti.
- Kalan hata siniflari sonraki onayli tasklara birakildi:
  - `useEffect` dependency uyarilari
  - import siralama uyarilari
  - kucuk Biome correctness / suspicious uyarilari

### 2026-05-05 - useEffect Dependency Duzeltmesi

- `apps/mobile/app/(tabs)/library.tsx` icinde Biome'un gereksiz gordugu `isFocused` dependency'si kaldirildi.
- `apps/mobile/app/book/[id].tsx` icinde eksik `activeSectionIndex` ve `hasPremium` dependency'leri eklendi.
- Hedefli dogrulama: `npx biome lint "apps/mobile/app/(tabs)/library.tsx" "apps/mobile/app/book/[id].tsx"` gecti.
- `npm run typecheck` gecti.
- `npm run check:edge-functions` gecti.
- `npm run lint` artik 11 format/hook disi hata ile kaliyor.

### 2026-05-05 - Import Siralama Duzeltmesi

- Biome'un organize-imports uyarisi verdigi 4 pipeline dosyasinda import sirasi duzeltildi.
- Davranis degisikligi veya refactor yapilmadi.
- Hedefli dogrulama: ilgili 4 dosya icin `npx biome lint` gecti.
- `npm run typecheck` gecti.
- `npm run check:edge-functions` gecti.
- `npm run lint` artik 7 import/hook/format disi hata ile kaliyor.
- Kalan hata siniflari sonraki onayli taska birakildi:
  - gereksiz `continue`
  - `forEach` yerine `for...of`
  - combining mark regex uyarilari

### 2026-05-05 - Final Lint Recovery

- Kalan 7 Biome correctness / suspicious uyarisi kucuk kapsamla giderildi.
- Gereksiz `continue` ifadeleri kaldirildi.
- Iki preview loop'u `forEach` yerine `for...of` ile yazildi.
- Combining mark temizleme regex'leri Unicode mark literal'iyle Biome uyumlu hale getirildi.
- Final dogrulama:
  - `npm run lint` gecti.
  - `npm run typecheck` gecti.
  - `npm run check:edge-functions` gecti.
