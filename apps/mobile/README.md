# SmartScrolling Mobile App

This folder contains the Expo / React Native client for SmartScrolling.

## Current Status

Uygulamanın odağı bilgi kartı akışı. Kitap/kütüphane bölümü telif nedeniyle 2026-11-24'te kaldırıldı (spec: `docs/specs/book-removal-card-ai.md`).

Çalışan:

- Supabase'ten gelen bilgi kartı akışı (sadece `status = 'published'` kartlar)
- **Karta Sor**: kartta "Sor" butonu → hazır sorular (ücretsiz) ve serbest soru (premium). Sunucu: `supabase/functions/card-ask`; günlük hak `ai_usage` tablosunda (ücretsiz 3, premium 30 — `supabase/functions/card-ask/config.ts`)
- Yanlış AI cevabını bildirme (`ai_content_reports.fact_id`)
- Giriş (e-posta, Google, Apple), kart kaydetme, günlük seri, yerel hatırlatıcı, push token
- Premium: RevenueCat; sunucu tarafı premium bayrağı `supabase/functions/revenuecat-webhook` ile `app_metadata.premium`'a yazılır

## Tech Stack

- Expo SDK 54
- React Native 0.81
- Expo Router 6
- TypeScript
- Zustand
- Supabase

## Local Setup

1. Install dependencies from the repo root:

```bash
npm install
```

2. Start the mobile app:

```bash
cd apps/mobile
npx expo start
```

3. Optional checks:

```bash
npm run lint
cd apps/mobile
npx tsc --noEmit
```

## Important Paths

- app routes: `apps/mobile/app`
- shared mobile logic: `apps/mobile/src`
- Supabase client: `apps/mobile/src/lib/supabase.ts`
- feed store: `apps/mobile/src/store/feedStore.ts`
- feed types: `apps/mobile/src/types/index.ts`

## Paylaşım ayarları

Paylaşım kartının bağlantısı ve alt yazısı `apps/mobile/src/config/share.ts` dosyasındaki `SHARE_CONFIG` alanlarından gelir. Kod bilmeden sadece tırnak içindeki değerleri değiştirin:

- `baseUrl`: paylaşılan bağlantının başlangıcı (`<baseUrl>/fact/<kart numarası>`). Sonuna `/` koymayın.
- `displayDomain`: paylaşım görselinin altında yazan alan adı (`https://` olmadan).
- `photoTimeoutMs`: fotoğrafın yüklenmesi için beklenecek süre (milisaniye). Süre dolarsa kart fotoğrafsız, yazılı görselle paylaşılır.

Gerçek alan adı alındığında `baseUrl` ve `displayDomain` aynı alan adına çevrilmelidir (ör. `https://<yeni-alan-adı>` ve `<yeni-alan-adı>`). Bu değişiklikten sonra eski alan adıyla paylaşılmış bağlantılar çalışmayabilir; yeni bağlantılar yeni alan adını kullanır.

## Maestro (uçtan uca testler)

- Kurulum: Maestro `C:\Users\<kullanıcı>\.maestro` altında durur; `JAVA_HOME` Android Studio'nun `jbr` klasörünü göstermelidir.
- Analitiği kapatmak için: `MAESTRO_CLI_NO_ANALYTICS=1`
- Misafir akışları: `npm run test:e2e:maestro`
- Hesap akışları (bilgiler dosyaya yazılmaz):
  `maestro test -e MAESTRO_TEST_EMAIL=... -e MAESTRO_TEST_PASSWORD=... .maestro/card-ask-account.yaml`
- Tüm akışlar `.maestro/subflows/launch.yaml` ile açılır; geliştirme sürümünde Expo sunucu ekranını kendisi geçer. Metro farklı portta ise: `-e DEV_SERVER_URL=http://10.0.2.2:<port>`
- Maestro'nun yardımcı uygulaması takılırsa: `adb uninstall dev.mobile.maestro` ve `adb uninstall dev.mobile.maestro.test`

## Known Gaps

- beğeni durumu hâlâ yerel; kaydetme oturum varken sunucuda tutulur
- `src/types/supabase.ts` otomatik üretilmiş tipler; kitap tabloları kaldırıldıktan sonra yeniden üretilmeli
- Karta Sor yayına alınmadan önce Supabase secret'ları gerekir: `GEMINI_API_KEY`, `GROQ_API_KEY`; webhook için `REVENUECAT_WEBHOOK_SECRET`

## Related Docs

- `docs/roadmap_todo.md`
- `docs/project_action_plan.md`
- `docs/tasks/p1_00_stabilization_task_list.md`
- `docs/tasks/p1_11_auth_foundation.md`
