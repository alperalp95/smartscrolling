# P6-09b App Store Compliance: Account Deletion ve AI Report

## Amac

- Apple App Store release oncesi iki kritik uyumluluk boslugunu kapatmak.
- Profilde kullanicinin hesabini ve verilerini silebildigi net bir akis sunmak.
- AI Chat icinde kullanicinin yanlis veya sakincali AI ciktisini raporlayabildigi net bir akis sunmak.
- Isi kucuk, onayli ve davranisi kolay dogrulanabilir alt tasklara bolmek.

## Kurallar

- Over-engineering yok.
- Refactoring yok.
- Task disi dosyalara dokunulmayacak.
- Her alt task kullanici onayi alindiktan sonra yapilacak.
- Her alt task sonunda yapilan is ve dogrulama sonucu raporlanacak.
- Git push yalnizca kullanici ayrica onaylarsa yapilacak.

## Baslangic Durumu

- Roadmap'te `P6-09b` release blocker olarak acik.
- `docs/ba_full_audit_report.md` Apple icin iki riski isaret ediyor:
  - Account deletion: hesap acilabilen uygulamada hesap/veri silme aksiyonu gerekli.
  - AI report: AI Chat ciktisi icin "yanlis/sakincali icerigi raporla" aksiyonu gerekli.
- Profil ekraninda cikis ve hesap yonetimi var, ama aninda isleyen hesap/veri silme akisi yok.
- Reader AI chat sheet'i mevcut, ama son kullaniciya acik raporlama aksiyonu yok.

## Alt Tasklar

- [x] P6-09b task dosyasini ac, kapsam ve kurallari netlestir.
- [x] Account deletion teknik kararini netlestir:
  - Bu release diliminde Edge Function mi, Supabase auth admin endpoint mi, yoksa soft-delete + destek akisi mi kullanilacak?
  - "Aninda isleyen" gereksinimi icin uygulanabilir minimum yolu sec.
- [x] Hesap/veri silme backend dilimini uygula.
- [x] Profil ekranina hesap/veri silme UI ve iki adimli onay ekle.
- [x] AI report veri modelini netlestir:
  - Rapor hangi alanlari tutacak?
  - Kullanici auth durumuna gore hangi alanlar nullable olacak?
  - Rapor AI chat mesajina mi, kitap/id baglamina mi, serbest metne mi baglanacak?
- [x] AI report backend/storage dilimini uygula.
- [x] Reader AI chat sheet'ine "Yanlis Icerigi Raporla" aksiyonu ve onay/geri bildirim UI'i ekle.
- [x] `npm run lint`, `npm run typecheck` ve ilgili hedefli smoke kontrollerini calistir.
- [x] Supabase remote migration apply yap.
- [x] `delete-account` Edge Function deploy yap.
- [x] Emulator smoke test listesini cikar.
- [ ] Roadmap, changelog ve task kapanis notlarini guncelle.

## Kapsam Disi

- Full destek talep sistemi.
- Moderation dashboard.
- Admin paneli.
- Analytics/event taxonomy.
- Store metinleri, privacy policy ve EULA sayfalarinin tamamini yazmak.
- Auth veya AI chat mimarisini refactor etmek.

## Uygulama Sirasi

1. Backend karar notu.
2. Account deletion backend.
3. Profile UI.
4. AI report storage karari.
5. AI report backend/storage.
6. Reader AI chat UI.
7. Verification ve dokumantasyon kapanisi.

## Task Log

### 2026-05-05 - Baslangic

- Task dosyasi acildi.
- P6-09b iki ana compliance dilimine ayrildi:
  - Hesap/veri silme.
  - AI Chat yanlis/sakincali icerik raporlama.
- Sonraki onayli adim olarak backend karar notu ayrildi.

### 2026-05-05 - Karar Notu

- Hesap/veri silme icin release yolu:
  - Supabase Edge Function uzerinden service role ile gercek silme yapilacak.
  - `auth.admin.deleteUser()` ile auth kullanicisi silinecek.
  - User-owned tablolar temizlenecek: `bookmarks`, `reading_progress`, `chat_sessions`, `user_activity`, `users`.
  - Public icerik tablolari silinmeyecek: `facts`, `books`, `book_sections`, `book_highlights`.
- Profil UI karari:
  - "Hesabimi ve Verilerimi Sil" aksiyonu net gorunur olacak.
  - Iki asamali onay kullanilacak.
  - Ikinci adimda kullanici `SIL` yazarak onay verecek.
- AI report karari:
  - Auth zorunlu olmayacak; guest kullanici da raporlayabilecek.
  - Kullanici varsa `user_id`, yoksa `null` kaydedilecek.
  - Yeni `ai_content_reports` tablosu migration ile eklenecek.
  - Assistant mesajlari raporlanacak; user mesajlari raporlanmayacak.
  - Rapor sebepleri:
    - `Yanlis bilgi`
    - `Sakincali / rahatsiz edici`
    - `Kitap baglamina uymuyor`
    - `Diger`
- Ilk teknik implementasyon sirasi:
  1. Account deletion Edge Function ve gerekli client helper.
  2. Profile UI iki asamali onay.
  3. `ai_content_reports` migration ve insert helper.
  4. Reader AI Chat report UI.
  5. Verification ve dokumantasyon kapanisi.

### 2026-05-05 - Account Deletion Backend

- `delete-account` Supabase Edge Function eklendi.
- Function mevcut session token'ini doğruluyor, service role key'i yalnizca Edge Function icinde kullaniyor.
- User-owned tablolar temizleniyor: `bookmarks`, `reading_progress`, `chat_sessions`, `user_activity`, `users`.
- Auth kullanicisi `auth.admin.deleteUser()` ile siliniyor.
- Mobil taraf icin `deleteCurrentAccount()` helper'i eklendi; basarili silme sonrasi local session sign-out yapiyor.
- Edge Function varlik kontrolu `npm run check:edge-functions` kapsamına alindi.

### 2026-05-05 - Profile Account Deletion UI

- Profil Ayarlar bolumune `Hesabimi ve Verilerimi Sil` aksiyonu eklendi.
- Ilk tiklamada inline onay paneli aciliyor.
- Kalici silme butonu yalnizca kullanici `SIL` yazdiktan sonra aktif oluyor.
- Basarili silme sonrasi local onboarding state temizleniyor ve kullaniciya sonuc bildiriliyor.

### 2026-05-05 - AI Report Storage Model

- `ai_content_reports` migration'i eklendi.
- Raporlar nullable `user_id` destekliyor; guest raporlar `user_id = null` olarak yazilabilecek.
- Tutulan minimum alanlar:
  - `book_id`, `book_title`
  - `assistant_message`
  - `reason`
  - `note`
- Sebep kodlari netlestirildi:
  - `wrong_information`
  - `harmful_or_uncomfortable`
  - `out_of_book_context`
  - `other`
- RLS insert-only olarak kuruldu: herkes rapor olusturabilir, ama non-null `user_id` yalnizca mevcut authenticated kullanicinin id'si olabilir.

### 2026-05-05 - AI Report Storage Helper

- Mobil taraf icin `submitAiContentReport()` helper'i eklendi.
- Helper assistant mesajini zorunlu tutuyor, guest kullanicida `user_id = null` yaziyor.
- Demo/non-UUID kitap id'leri `book_id = null` olarak kaydediliyor; `book_title` baglami korunuyor.
- Insert sonrasi select yapilmiyor; tablo insert-only RLS modeliyle uyumlu kalıyor.

### 2026-05-05 - Reader AI Report UI

- Reader AI Chat sheet'inde assistant mesajlarinin altina `Yanlis Icerigi Raporla` aksiyonu eklendi.
- Rapor paneli yalnizca assistant mesajlari icin aciliyor.
- Kullanici dort sebepten birini secebiliyor:
  - `Yanlis bilgi`
  - `Sakincali`
  - `Baglama uymuyor`
  - `Diger`
- Basarili veya hatali rapor gonderimi chat sheet icinde kisa geri bildirim olarak gosteriliyor.

### 2026-05-05 - Final Local Verification

- `npm run lint` gecti.
- `npm run typecheck` gecti.
- `npm run check:edge-functions` gecti.
- Sonraki adim olarak Supabase remote migration apply ve `delete-account` Edge Function deploy ayrildi.

### 2026-05-05 - Remote Apply / Deploy

- `npx supabase db push --linked --yes` ilk denemede `uuid_generate_v4()` remote fonksiyon eksigi nedeniyle durdu.
- Migration id default'u mevcut repo pattern'iyle uyumlu olacak sekilde `gen_random_uuid()` olarak duzeltildi.
- `npx supabase db push --linked --yes` tekrar calisti ve `20260505082724_p6_09b_ai_content_reports.sql` remote'a uygulandi.
- `npx supabase migration list --linked` ile `20260505082724` migration'inin remote history'de oldugu dogrulandi.
- `npx supabase functions deploy delete-account --use-api` ile `delete-account` Edge Function deploy edildi.
- `npx supabase functions list` ile `delete-account` function'inin `ACTIVE` ve `VERSION 1` oldugu dogrulandi.

## Emulator Smoke Test Listesi

1. Profil > Ayarlar icinde `Hesabimi ve Verilerimi Sil` satirini gor.
2. Satira tikla; modern onay popup'i acilsin ve `SIL` yazmadan `Kalici Olarak Sil` butonu disabled kalsin.
3. `SIL` yaz; buton aktif olsun. Test hesabinda final silme aksiyonunu calistiracaksan basarili sonuc sonrasi profil misafir moda donmeli.
4. Reader icinde bir kitap ac, highlight popup'tan `Yapay Zekaya Sor` ile chat sheet'i ac.
5. Assistant mesajinin altinda `Yanlis Icerigi Raporla` aksiyonunu gor.
6. Aksiyona tikla; dort sebep chip'i gorunsun: `Yanlis bilgi`, `Sakincali`, `Baglama uymuyor`, `Diger`.
7. Bir sebep secip `Gonder` de; basarili durumda `Rapor alindi. Tesekkurler.` geri bildirimi gor.
8. Chat sheet'i kapat/ac; ana reader akisi, hazir sorular ve gonder butonu normal calismaya devam etsin.

### 2026-05-05 - Smoke Bulgu Duzeltmeleri

- Supabase Storage kontrol edildi:
  - `book-files/tr-books` altinda 9 Turkce kitap dosyasi duruyor.
  - `book-files/public-domain/kendime-dusunceler.txt` duruyor.
- Remote DB kontrol edildi:
  - `books = 0`
  - `book_sections = 0`
  - `book_highlights = 0`
- Library boslugu DB metadata/section recovery olarak ayrildi; storage dosyalari tek basina app'te gorunmuyor.
- Yeni user profil tercihleri icin `users` update akisi `upsert` yapildi; row eksikse ilgi alani, gunluk hedef ve bildirim tercihi kalici yazilabilecek.
- Hesap silme ikinci onayi inline panelden modal popup'a tasindi.

### 2026-05-05 - Library DB Recovery

- Storage'daki kitap dosyalari gecici olarak indirildi ve DB recovery icin kullanildi.
- `zaman-nedir.txt` storage'da 0 byte oldugu icin DB'ye bos kitap/section olarak basilmadi.
- Remote DB'ye 9 kitap ve 4009 `book_sections` kaydi geri basildi.
- Dogrulama:
  - `books = 9`
  - `book_sections = 4009`
  - `book_highlights = 0`
- App'in kullandigi anon REST sorgusu ile `books` listesi 200 OK dondu.
- Gecici recovery dosyalari temizlendi.
