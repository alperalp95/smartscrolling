# P35-12 - Streak Reminder Notification

## Goal

Gunluk hedef tamamlanmadiysa veya streak bugun riskteyse kullaniciya secili saatte rahatsiz etmeyen tek local hatirlatici kurmak.

## Scope

- Local-only best-effort scheduling.
- Hedef mantigi: `daily_goal_type = facts` ve bugunku `facts_read < daily_goal_value`.
- Streak risk mantigi: bugun aktif gun yoksa ama dun aktif gun varsa ayni local reminder icinde streak-risk copy'si kullanilir.
- Toggle, saat degisimi, app acilisi ve kart okuma sonrasi cancel/reschedule.
- Duplicate pending notification temizligi.
- Android sistem notification izni sonradan kapatilirsa pending reminder temizligi.

## Checklist

- [x] Local schedule/cancel/reconcile helper'lari eklendi.
- [x] Pending notification'lar `content.data` etiketiyle SmartScrolling'e ozellestirildi.
- [x] Daily goal incomplete durumunda streak reminder copy'si kullaniliyor.
- [x] P35-02 streak-risk state'i ayni tek local reminder copy'sine baglandi.
- [x] Hedef tamamlaninca bugunku reminder best-effort iptal edilip sonraki uygun zamana aliniyor.
- [x] Emulator UX bulgulari sonrasi OS permission revoked durumunda reminder temizligi Profile focus sync'e baglandi.
- [x] Android development build smoke sonucu kaydedildi.

## Acceptance

- Bugun hedef tamamlanmadiysa secili saatte reminder kurulur.
- Bugun bos ve dun aktifse ayni pending reminder streak kirilma uyarisi copy'si kullanir.
- Bugun hedef tamamlandiysa bugunku reminder best-effort iptal edilir.
- Toggle kapatilinca pending reminder temizlenir.
- Android App Info'dan notification kapatilinca pending reminder temizlenir.
- Ayni anda birden fazla SmartScrolling daily reminder kalmaz.

## Limitation

- Local notification tetik aninda Supabase sorgusu calistirilmaz. Strict "hedef tamamlandiysa asla gitmesin" garantisi remote push veya background task gerektirir ve bu sprint kapsaminda degildir.

## Smoke

- Fiziksel Android development build uzerinde local reminder akisi basarili goruldu.
- Daily goal tamamlanmadi/tamamlandi durumlari ve tek pending SmartScrolling reminder beklentisi kabul edildi.
