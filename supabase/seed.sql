-- 2026-11-24: Telif nedeniyle kitap metni bu dosyadan cikarildi. Tablolar drop_book_feature migration'i ile kaldirildi.
-- Seed Fake Data (Facts and Books) for Local MVP
-- These UUIDs are fixed so we can easily join them if needed

-- 1. Insert Books (Project Gutenberg & TR Public Domain Examples)


-- 2. Insert Facts (Wikipedia Featured Articles & NASA)
-- Map media_url to the generated image keys

INSERT INTO public.facts (id, title, content, category, tags, read_time_sq, source_url, source_label, verified, media_url)
VALUES 
  (
    'fc111111-1111-1111-1111-111111111111',
    'Kara Delikler Işığı Nasıl Emer?',
    'Kara delikler, o kadar yoğun kütleye sahiptir ki olay ufku ötesinde ışık dahil hiçbir şey kaçamaz. Bu devasa kütle çekim gücü, uzay-zaman düzlemini bir huni gibi büker. Işık bile bu huninin içindeki "olay ufku" bariyerinin ötesine geçtiğinde, sonsuz yoğunluklu tekilliğe (singularity) doğru çekilir ve evrenle bağlantısı kopar. Bu yüzden uzaydan bakıldığında sadece siyah, yutucu bir küre olarak görünürler.',
    '🔬 BİLİM',
    '{"uzay", "astrofizik", "kara-delik"}',
    18,
    'https://en.wikipedia.org/wiki/Black_hole',
    'NASA / Astrophysical Journal · 2023',
    true,
    'bg_black_hole'
  ),
  (
    'fc222222-2222-2222-2222-222222222222',
    'Roma İmparatorluğu Neden Çöktü?',
    'Batı Roma''nın çöküşü (M.S. 476) efsanelerde tek bir gecede olmuş gibi anlatılsa da, aslında yüzyıllara yayılan "kademeli bir çözülme" sürecidir. Sınırların devasa büyüklüğünü korumak için gereken askeri harcamalar ekonomiyi tüketmiştir. Buna barbar kavimlerin sürekli göç baskısı ve Senato ile ordudaki liderlik krizleri eklenince tarihin en büyük imparatorluklarından biri içten çürüyerek parçalanmıştır.',
    '📜 TARİH',
    '{"roma", "antik-çağ", "çöküş"}',
    22,
    'https://en.wikipedia.org/wiki/Fall_of_the_Western_Roman_Empire',
    'Wikipedia · Peer Reviewed',
    true,
    'bg_rome_ruins'
  ),
  (
    'fc333333-3333-3333-3333-333333333333',
    'Stoacılık: Modern Dünya İçin Antik Hikmet',
    'Stoacılar, insanın mutluluğunun dış dünyaya ve "başına gelenlere" değil, bu olaylara gösterdiği "tepkilere" bağlı olduğunu savunur. Marcus Aurelius ve Epiktetos gibi düşünürlerin ana kuralı "Dikotomi" prensibidir: Neyi kontrol edebileceğini bil. Diğer insanların düşünceleri, hava durumu veya ekonomik kriz kontrolünde değildir. Kontrolünde olan tek şey, o anda alacağın ahlaki tutum ve verdiğin karardır.',
    '🧠 FELSEFE',
    '{"stoacılık", "felsefe", "ahlak", "zihin"}',
    24,
    'https://plato.stanford.edu/entries/stoicism/',
    'Stanford Encyclopedia of Philosophy',
    true,
    'bg_stoic_statue'
  ),
  (
    'fc444444-4444-4444-4444-444444444444',
    'Kuantum Bilgisayarlar Nasıl Çalışır?',
    'Klasik bilgisayarlar dünyayı 0 ve 1''lerden oluşan "bit"ler ile yorumlar. Kuantum bilgisayarları ise atom altı özelliklerinden faydalanan "qubit"leri kullanır. Qubitler, "Süperpozisyon" adı verilen ilke sayesinde aynı anda hem 0 hem de 1 olabilir. Tıpkı bir labirenti çözmeye çalışırken tek bir yolu denemek yerine aynı anda tüm olası yollara yürümeleri gibi düşünün. İlaç tasarımı ve devasa şifreleme sorunlarını saniyeler içinde çözebilirler.',
    '💻 TEKNOLOJİ',
    '{"kuantum", "bilgisayar", "fizik", "gelecek"}',
    20,
    'https://en.wikipedia.org/wiki/Quantum_computing',
    'IBM Research · 2024',
    true,
    'bg_quantum_pc'
  );

-- 3. Insert specific Book Highlights to simulate AI reading
