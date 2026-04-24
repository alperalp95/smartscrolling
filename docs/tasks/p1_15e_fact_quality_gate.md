# P1-15e - Fact Quality Gate

## Amac

Groq ciktilarinin kalite seviyesi dusuk oldugunda veya kaynakla tutarsiz hale geldiginde `facts` tablosuna yazilmasini engellemek.

## Alt Gorevler

- [x] Pipeline icine ayri bir `quality-policy` modulu ekle
- [x] `insertFact` oncesi title, content, category, tags ve source alanlarini kalite gate ile kontrol et
- [x] Dusuk kaliteli kayitlari `quality_rejected:*` status kodu ile logla
- [x] Groq promptunu soru-cumlesi basliklari ve bos kategori uretimini azaltacak sekilde sikilastir
- [x] Wikipedia random source seciminde dusuk bilgi degerli maddeleri source seviyesinde ele
- [x] Groq katmanina kisa veya yuzeysel iceriklerde tek seferlik "daha derin anlat" retry mekanizmasi ekle
- [x] `json_validate_failed` durumlarinda `failed_generation` uzerinden tek seferlik JSON repair recovery ekle
- [x] Groq promptunu "yorum yapma, bilgi uydurma, yalnizca kaynakta desteklenen bilgiyi yaz" kuralina gore sikilastir
- [x] Source title ve category hint uzerinden calisan rule-based consistency gate ekle
- [x] Ingilizce source title ile Turkce cikti arasindaki kavram kopuslarini azaltmak icin hafif token alias katmani ekle
- [ ] Quality reject reason'larini daha sonra dashboard veya run raporu icinde ayrintili kir

## Notlar

- Ilk tur quality gate su sinyalleri eler: kisa/gecersiz baslik, dusuk kaliteli baslik kaliplari, kisa content, eksik source, gecersiz kategori, yetersiz tag.
- Bu gorev icerik kalitesini pipeline seviyesinde artirir; mobil uygulama akisini degistirmez.
- Son prompt turunda Groq'un yorumcu gibi davranmasi degil, kaynakta acikca bulunan bilgiyi Turkce ve okunur sekilde yeniden kurmasi hedeflenir.
- 2026-04-19 test notu: prompt "yorum yok / uydurma yok" seviyesinde sikilastirilsa bile zayif source secimi veya kategori sapmasi kotu kartlar uretebilir; bu nedenle sonraki katman category consistency ve source relevance enforcement olmalidir.
- Source-based consistency gate ikinci bir LLM cagrisi kullanmaz; source title overlap ve category hint uzerinden dusuk maliyetli reject karari verir.
- Son turda consistency gate'e sinirli bir `EN -> TR concept alias` listesi eklendi; `Byzantine -> Bizans`, `Socratic -> Sokratik`, `Empire -> Imparatorluk`, `Method -> Yontem`, `Public -> Halk`, `Health -> Saglik` gibi ciftler gereksiz `source_topic_drift` reject'lerini azaltti.
- Sonraki dilimde Wikipedia kesfinde `en` seed/summary stabilitesi korunurken, mumkun olan maddelerde `tr.wikipedia` summary ve `tr.wikipedia` page URL tercih edilmeye baslandi; bu sayede Groq'un tam ceviri yukunu azaltmak ve yari Turkce / yari Ingilizce cikti riskini dusurmek hedeflenir.
- Saglik tarafinda `vaccine/vaccines/vaccination`, `immune/immunity` ve `protection/prevent` gibi kavramlar icin alias listesi genisletildi; boylece MedlinePlus kartlarinda gereksiz `source_topic_drift` reject'leri azaltilmaya calisilirken quality gate'in ana sertligi korunur.
- Felsefe tarafinda da `epistemology`, `knowledge` ve `reason` gibi kavramlar icin alias listesi genisletildi; amac `Bilginin Temel Kosullari` gibi Turkce ama konuya sadik basliklarin gereksiz drift reject'i yememesidir.
- MedlinePlus tarafinda source title da kaynaga daha sadik hale getirildi (`Heart Health` yerine `Heart Diseases`) ve `heart/cardiac/cardiovascular/coronary/artery` alias'lari eklenerek kalp-damar iceriklerinde gereksiz drift reject'i azaltildi.
- Saglik terminolojisinde `immune system` tarafina bir tur daha ince ayar yapildi; `imun`, `imun sistem` ve `system -> sistem` varyantlari eklenerek Turkce/yarı-latin saglik terimlerinde gereksiz drift reject'leri azaltildi.
- Sonraki slice'ta MedlinePlus icin `obesity`, `stress`, `exercise`, `fitness`, `pressure`, `weight`, `hypertension` gibi ek alias'lar tanimlandi; hedef, saglik kartlarinda konuya sadik ama TurkcelesmIs basliklarin gereksiz `source_topic_drift` reject'i yememesidir.
- Teknoloji tarafinda da `cloud`, `compiler`, `compression`, `computing`, `cryptography`, `database`, `distributed`, `search`, `software`, `source` gibi alias'lar genisletildi; amac yeni teknoloji seed'lerinden gelen Turkce basliklarin gereksiz drift reject'i yememesidir.
- Son saglik turunda `mobility`, `patient`, `rehabilitation` ve `safety` alias'lari eklendi; pratik saglik basliklarinda konuya sadik Turkce ciktilarin gereksiz drift reject'i yememesi hedeflenir.
