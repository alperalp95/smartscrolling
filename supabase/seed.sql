-- Seed Fake Data (Facts and Books) for Local MVP
-- These UUIDs are fixed so we can easily join them if needed

-- 1. Insert Books (Project Gutenberg & TR Public Domain Examples)
INSERT INTO public.books (id, title, author, cover_url, description, category, total_pages, epub_url, is_premium)
VALUES 
  (
    '11111111-1111-1111-1111-111111111111', 
    'Kendime Düşünceler', 
    'Marcus Aurelius', 
    'https://images.unsplash.com/photo-1544947950-fa07a98d237f', 
    'Stoacı imparatorun kendi kendine tuttuğu felsefi notlar. Doğaya uygun yaşamak, erdem ve ölüm üzerine.', 
    'Felsefe', 
    160, 
    'https://www.gutenberg.org/files/2680/2680-h/2680-h.htm', 
    false
  ),
  (
    '22222222-2222-2222-2222-222222222222', 
    'Kürk Mantolu Madonna', 
    'Sabahattin Ali', 
    'https://images.unsplash.com/photo-1589998059171-988d887df646', 
    'Raif Efendi ve Maria Puder arasındaki modern klasik. (Telif süresi 70 yılını doldurmuştur).', 
    'Roman', 
    164, 
    NULL, 
    true
  );

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
INSERT INTO public.book_highlights (book_id, word, type, context, ai_definition)
VALUES 
  (
    '11111111-1111-1111-1111-111111111111', 
    'Logos', 
    'concept', 
    'Doğanın logosuna uygun yaşa.', 
    'Stoacılıkta evreni yöneten tanrısal akıl, nizam veya doğa yasasıdır. Modern anlamda "evrenin mantığı" olarak çevrilebilir.'
  ),
  (
    '11111111-1111-1111-1111-111111111111', 
    'Dikotomi', 
    'concept', 
    'Kontrol dikotomisi bizi özgürleştirir.', 
    'Kontrol edebildiğimiz ve edemediğimiz şeyler arasındaki kesin ayrımdır. Stoacılığın temel ilkesidir.'
  );
