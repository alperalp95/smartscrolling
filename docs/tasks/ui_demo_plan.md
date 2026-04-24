# 🎨 UI Demo — Uygulama Planı

## Hedef
MVP ekranlarının tarayıcıda görülebilen interaktif bir HTML/CSS/JS demosu.  
Gerçek React Native kodu yerine browser demo → hızlı iterasyon, görsel onay, sonra RN'e taşıma.

---

## Demo Kapsamı (MVP Ekranları)

| Ekran | Bileşenler | Öncelik |
|---|---|---|
| **1. Splash / Onboarding** | Logo, tagline, CTA | 🔴 Yüksek |
| **2. Günlük Akış (Feed)** | Bilgi kartları, kategori filtresi, swipe | 🔴 Yüksek |
| **3. Kitap Kütüphanesi** | Kapak grid, arama, filtre | 🔴 Yüksek |
| **4. Kitap Okuyucu** | Sayfalı metin, highlighted kelimeler, AI popup | 🔴 Yüksek |
| **5. AI Chat** | Chat balonu, streaming animasyonu | 🟡 Orta |
| **6. Profil & Streak** | Streak sayacı, aktivite grafiği, ilerleme | 🟡 Orta |

---

## Tasarım Sistemi

### Renk Paleti
- **Background:** `#0A0A0F` (derin siyah)
- **Surface:** `#12121A` (kart arka planı)
- **Surface Alt:** `#1A1A26`
- **Primary:** `#6C63FF` (mor — ana aksiyon)
- **Accent:** `#FF6B6B` (streak / önemli)
- **Success:** `#4ECDC4` (tamamlama)
- **Text Primary:** `#F5F5F5`
- **Text Secondary:** `#8888AA`
- **Highlight Yellow:** `#FFD166` (kitap keyword)
- **Highlight Blue:** `#5BC0EB` (referans)

### Tipografi
- **Font:** `Inter` (Google Fonts)
- **Heading:** 700 weight
- **Body:** 400 weight
- **Caption:** 300 weight

### Mobil Çerçeve
- 390×844px (iPhone 14 oranı)
- Tarayıcıda telefon frame içinde gösterim

---

## Dosya Yapısı

```
smartscrolling/
└── demo/
    ├── index.html        ← Ana demo shell (telefon frame + navigasyon)
    ├── styles/
    │   ├── base.css      ← Design system tokens
    │   └── components.css← Bileşen stilleri
    └── screens/
        ├── feed.js       ← Günlük Akış
        ├── library.js    ← Kütüphane
        ├── reader.js     ← Kitap Okuyucu + AI Popup
        ├── chat.js       ← AI Chat
        └── profile.js    ← Profil & Streak
```

---

## Uygulama Adımları

- [x] Proje dosyalarını analiz et
- [x] Plan hazırla
- [ ] Design tokens + base CSS oluştur
- [ ] Telefon frame shell (index.html)
- [ ] Feed ekranı (bilgi kartları + swipe)
- [ ] Library ekranı (kitap grid)
- [ ] Reader ekranı (metin + highlight + AI popup)
- [ ] Profile ekranı (streak + aktivite)
- [ ] Tab bar navigasyon (ekranlar arası geçiş)
- [ ] CHANGELOG güncelle
