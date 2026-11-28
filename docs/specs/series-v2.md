# Spec — Seriler v2: okuma kartı, tamamlandı işareti, akışta seri tanıtımı

**Durum:** Tasarım onaylandı (kullanıcı, 2026-11-28: "Onaylıyorum") · **Yazan:** Atlas (PO)
**Taslak:** scratchpad `series-mockup/seriler-taslak-2.html` · **Ön koşul:** `docs/specs/series.md` (yayında)

## 1. Neden (kullanıcının emülatör gözlemi)
- Okuma ekranında başlık ve metin üste yapışık, ekranın orta/altı boş kalıyor.
- Bitirilen serinin görünür bir karşılığı yok.
- Seriler yalnız sekmeye girenin göreceği yerde; akış kullanıcıları seriden haberdar değil.

## 2. Okuma kartı (taslak bölüm 1)
- Zemin: marka renklerinden yumuşak ışıklar (paylaşım görseli C1 dili), üstünde `colors.shareCardBg` zeminli kart.
- Kart **her sayfada aynı yükseklikte** (üst bar ile alt güvenli alan arası) — kartlar arası zıplama yok.
- Kart içi: meta = `<BÖLÜM ADI> · n/m` (bölümün kaçıncı kartı; tek kartlık bölümde `· 1/1` yazılmaz), başlık = bölüm başlığı (`type.cardTitle`), gövde = **okuma yazısı 17/27** (temaya `type.reading` olarak eklenir), en altta sabit kaynak satırı.
- İlk kart (seri başı): kapak görseli kartın üstünde kalır (bugünkü gibi), altında aynı düzen.
- Bölümün son kartı kısa kalırsa boşlukta ortalı ipucu: "Sonraki bölüm" + `<sonraki bölüm adı> ↓` (son bölümde yok).
- Değişmez: dikey sayfalama, otomatik ilerleme yok, ilerleme kaydı, kilit/bilgi sayfaları.

## 3. Tamamlandı ve ilerleme (taslak bölüm 2)
- "Tamamlandı" = `completedAt` dolu.
- Sekme: tamamlanan serinin kapağında yeşil "✓ Tamamlandı" çipi (`colors.success`), "Devam et" rafına girmez. Başlanmış (tamamlanmamış) serilerin raf kapağının altında ince ilerleme çizgisi ve "n / N kart" metni. Öne çıkan (hero) kart da aynı çip/ilerleme kuralını izler.
- Kapak sayfası (tamamlanmış): başlığın yanında "✓ Tamamlandı", açıklama "Seriyi bitirdin · N kart", düğme "Baştan oku" (ikincil stil, `from=1`), altında "Sıradaki öneri": aynı kategoriden, tamamlanmamış, en yeni seri; yoksa herhangi bir tamamlanmamış seri; yoksa gösterilmez.
- Baştan okumak ilerlemeyi düşürmez (v1'deki "ilerleme geri gitmez" kuralı korunur).

## 4. Akışta seri tanıtım kartı (taslak bölüm 3)
- Kart: kapak (yoksa marka degradesi) ve arkasında üst üste kaymış **2 kart silueti**; çip "SERİ · N kart"; premium seri ve kullanıcı premium değilse ek "PREMIUM" çipi. Meta `<KATEGORİ> · SERİ`, başlık, serinin özeti (`series.summary`, ilk paragraftan ≤240 karakter).
- Düğme: ücretsiz ya da kullanıcı premium → "Seriyi okumaya devam et →" (`/series/<slug>/read?from=2`); premium seri + kullanıcı premium değil → "İlk 3 kartı ücretsiz oku →" (`from=2`). Altında "N kart · ~N dk · ücretsiz" / "N kart · tamamı Premium'da".
- **Kaldığın yerden kartı:** kullanıcının başlayıp bitirmediği seri varsa sıradaki tanıtım yerine "Kaldığın yerden: <seri> · n/N" (aynı kart, düğme "Kaldığın yerden devam et →", `from=lastPosition`).
- Kart **otomatik geçmez**; reklam kartı gibi kullanıcı kaydırınca geçer.
- **Sıklık (ayar dosyası, kod bilmeyen düzenler):** ilk tanıtım `firstAfter` (varsayılan 8) karttan sonra, sonra her `interval` (varsayılan 12) içerik kartında bir; reklam yuvasıyla aynı noktaya düşerse bir sonraki karta kayar. Aynı seri tanıtımı bir kullanıcıya **en çok 1 kez** (cihazda "görülen tanıtımlar" kaydı, gösterildiğinde işaretlenir). Ücretsiz ve premium **dönüşümlü** (`alternate: true`). Tamamlanan seriler hiç gösterilmez. Gösterilecek seri kalmadıysa kart eklenmez.
- Misafir de görür.

## 5. Kapsam dışı
- Analitik/ölçüm (ileride).
- Tanıtım kartında "Karta Sor", beğeni.
- Sunucu tarafında "görülen tanıtım" kaydı (cihazda yeterli).

## 6. Kabul
- Birim: tanıtım yerleştirme (ilk/aralık, reklamla çakışma, bir kez, dönüşüm, tamamlanan hariç, kaldığın yerden önceliği, liste bitince durma); sıradaki öneri seçimi; tüm ilerlemenin toplu çekilmesi.
- Bileşen: okuma kartı sabit yükseklik + n/m + sonraki bölüm ipucu; Tamamlandı çipi/ilerleme; kapak "Baştan oku" + öneri; tanıtım kartı ücretsiz/premium/kaldığın yerden metinleri ve yönlendirme.
- Emülatör: üç ekranın görüntüsü; typecheck, lint, test:unit.
