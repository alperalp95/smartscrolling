# @smartscrolling/pipeline

SmartScrolling içerik hattı: kaynaklardan bilgi kartı üretir.

## İçerik hattı v2 ayarları

v2 hattının bütün ayarları tek dosyada durur:

```
packages/pipeline/config/pipeline.config.json
```

Bu dosyayı kod bilmeden düzenleyebilirsiniz. Birkaç kural var:

- Dosya JSON biçimindedir. Metinler çift tırnak (`"..."`) içinde yazılır, sayılar tırnaksız yazılır. Satır sonlarındaki virgülleri silmeyin. Listenin ya da bölümün **son** öğesinden sonra virgül konmaz.
- `"_aciklama"` ile başlayan alanlar sadece not içindir, program bunları okumaz. İstediğiniz gibi değiştirebilirsiniz.
- Bir alanı yanlış yazarsanız (ör. bir rol eksikse ya da olmayan bir sağlayıcı yazdıysanız) hat çalışmadan önce durur. Hata mesajı hangi alanın yanlış olduğunu söyler, ör. `[pipeline.config] roles.verifier.chain[1].provider: sağlayıcı 'gemni' providers bölümünde tanımlı değil`.
- API anahtarları bu dosyaya **yazılmaz**. Dosyada sadece anahtarın hangi ortam değişkeninde durduğu yazar (`apiKeyEnv`). Anahtarlar GitHub Actions secret'larında ya da yerel ortam değişkenlerinde tutulur.

### `roles`: hangi iş hangi modelle yapılır

Hatta beş iş (rol) var:

| Rol | Ne yapar |
|---|---|
| `scorer` | Puanlayıcı. Aday bilgilere şaşırtıcılık, Türk okur için ilgi gibi puanlar verir. |
| `writer` | Yazar. Türkçe kartı yazar. |
| `verifier` | Doğrulayıcı. Kartı iddialara böler, her iddiayı kancaya ve destek paragrafına karşı kontrol eder (iddia ikisinden birinde açıkça ya da doğrudan çıkarılabilir şekilde geçiyorsa geçer). Başlık da bir iddiadır; ayrıca "başlık metindeki olguyla aynı şeyi mi söylüyor, terimler doğru çevrilmiş mi?" diye sorulur. Desteklenmeyen iddia ya da uyumsuz başlık varsa kart hemen elenmez: yazara **bir kez** onarım için geri gider ("şu iddiaları çıkar ya da kaynakla uyumlu hale getir", "başlığı düzelt"), sonra yeniden doğrulanır. Yazardan farklı bir model ailesinden ve "düşünmeyen" bir model olmalı. |
| `judge` | Hakem. Benzerliği "gri bölgede" kalan iki kart için "aynı bilgi mi?" diye karar verir. |
| `embedding` | Metni sayı dizisine (vektör) çevirir. Tekrar eden kartları bulmak için kullanılır. |

Her rolün bir `chain` (zincir) listesi vardır. Zincir **yukarıdan aşağıya** denenir. İlk model dolarsa (günlük sınır), hata verirse, bozuk/kesik yanıt verirse ya da kapatılmışsa sıradakine geçilir.

- Zincirin hepsi **dolu ya da erişilemez** ise (kota, "çok istek", sunucu hatası, anahtar yok) o iş ertesi güne kalır; hat çökmez.
- Modeller çalıştığı hâlde **hepsi bozuk çıktı** verdiyse (geçersiz JSON, kesik yanıt) bu "tükenme" sayılmaz: o aday (ya da puanlama grubu) bir hata hakkı kaybeder (3 hatada elenir), hat sıradaki adaylarla devam eder.
- Her başarısız denemenin nedeni log'a `[llm] provider_failed role=scorer groq/... kind=retryable status=429 :: ...` biçiminde yazılır (anahtar değerleri silinir). Usage dosyasında da modelin altında `failures` ve `lastError` görünür; `requests: 0` ama `failures: 2` ise model denenmiş ama düşmüş demektir.

#### `maxTokens`: bir yanıtın en fazla uzunluğu

Her rolde `maxTokens` modelin tek yanıtta en fazla kaç token yazabileceğidir:

| Rol | Değer | Not |
|---|---|---|
| `scorer` | `600` | 10 kanca, kısa anahtarlı JSON ≈ 300-400 token. Groq'un dakikalık çıktı sınırının (1000) altında kalmalı. |
| `writer` | `1000` | Kart ≈ 120 token + gpt-oss "low" düşünme ≈ 180. Groq'un dakikalık çıktı sınırını (1000) aşmamalı. |
| `verifier` | `800` | Başlık + en fazla 5 kısa iddia ≈ 170-270 token (düşünmeyen model). |
| `judge` | `200` | Tek karar. |

Yanıt bu sınırda kesilirse (sağlayıcı `finish_reason: length` der) yanıt kullanılmaz, hata sayılır ve zincirde sıradaki model denenir. Log'da `[llm] truncated ...` görürseniz o rolün `maxTokens` değerini artırın. Groq'ta kullanılan rollerde `maxTokens`'ı 1000'in üstüne çıkarmayın (aşağıda "dakikalık sınırlar").

Bir zincir satırına ayrıca `"maxTokens"` yazılabilir; o model için rolünkinin yerine geçer. Puanlayıcının Groq yedeği `openai/gpt-oss-20b` "düşünen" bir model olduğu için kendi değeri `1000`'dir (600'de düşünürken kesilirdi):

```json
{ "provider": "groq", "model": "openai/gpt-oss-20b", "params": { "reasoning_effort": "low" }, "maxTokens": 1000 }
```

`expectedOutputTokens` (isteğe bağlı) bir yanıtın **tahmini** uzunluğudur: `scorer` 400, `writer` 350, `verifier` 250. Hat Groq'un dakikalık çıktı sınırı için her isteğe bu kadar yer ayırır. Gerçek yanıtlar sürekli daha uzunsa artırın, daha kısaysa azaltın (azaltmak hattı hızlandırır).

#### Puanlayıcı zinciri

1. `groq / qwen/qwen3.8-27b` (`reasoning_effort: none`, düşünmez).
2. `groq / openai/gpt-oss-20b` (`reasoning_effort: low`): Groq'ta aynı ücretsiz sınırlara sahip ikinci model. Yazar zincirinde de kullanılan modeldir; puanlayıcı ona sadece qwen dolunca ya da hata verince gider.
3. `cloudflare / @cf/mistralai/mistral-small-3.1-24b-instruct`: düşünmez, Türkçe destekli. 10 kancalık bir grup ≈ 47 Neuron.
4. `cloudflare / @cf/meta/llama-4-scout-17b-16e-instruct`: düşünmez, çok dilli. 10 kancalık bir grup ≈ 52 Neuron.

Cloudflare'in önceki yedeği `@cf/qwen/qwen3-30b-a3b-fp8` 20.11.2026'da kapatıldı (HTTP 410 "Model has been deprecated"). Ücretsiz modeller böyle aniden kapanabilir; bu yüzden zincirde birden fazla yedek var.

#### Doğrulayıcı zinciri ve Gemma'nın "düşünme" modu

İkinci dry-run'da Gemma 4 (`@cf/google/gemma-4-26b-a4b-it`) her doğrulamada `maxTokens` sınırına kadar "düşündü" ve yanıtı kesildi; hepsi günlük ücretsiz limiti çok düşük olan Gemini'ye düştü. Cloudflare'in model sayfası Gemma 4'ün düşünme modunun nasıl kapatılacağını belgelemiyor. Bu yüzden zincir şöyle:

1. `@cf/mistralai/mistral-small-3.1-24b-instruct` (birincil): düşünme modu yok, Türkçe destekli, OpenAI ailesinden değil. Çağrı başına ≈ 32 Neuron (700 girdi + 200 çıktı token).
2. `@cf/google/gemma-4-26b-a4b-it` + `"params": { "chat_template_kwargs": { "enable_thinking": false } }`: Gemma'nın kendi sohbet şablonundaki anahtarla düşünme kapatılmaya çalışılır. Cloudflare bu anahtarı belgelemediği için dry-run'da teyit edilmeli: log'da Gemma için `[llm] truncated` görünüyorsa kapanmamıştır.
3. `gemini-3.5-flash-lite`: son yedek.

Gemma'da düşünme gerçekten kapanıyorsa (çağrı başına ≈ 12 Neuron) Gemma'yı birincil yapmak Neuron bütçesini üçte birine indirir.

#### Qwen3 "düşünme" modu

Qwen3 modelleri cevaptan önce uzun bir "düşünme" metni yazabilir; bu hem token harcar hem de `maxTokens`'i doldurup JSON'u bozabilir. Puanlayıcıda kapalıdır:

- Groq: `"params": { "reasoning_effort": "none" }` (Groq dokümanı: Qwen 3.8 27B için `none` düşünmeyi kapatır).
- Zincire ileride Cloudflare'de bir Qwen3 modeli eklerseniz: `"userSuffix": " /no_think"`. `userSuffix` isteğin son kullanıcı mesajının sonuna eklenen metindir; Qwen3'ün resmi "yumuşak anahtarı" `/no_think` düşünmeyi kapatır.

Model yine de `<think>...</think>` bloğu yazarsa hat bunu yanıttan ayıklar.

Zincirdeki her satır bir sağlayıcı ve bir model adıdır:

```json
{ "provider": "groq", "model": "qwen/qwen3.8-27b" }
```

#### Örnek: model nasıl değiştirilir

Groq puanlayıcı modelini kapattı ve yerine `qwen/qwen4-32b` geldi diyelim. `scorer` zincirindeki ilk satırda sadece model adını değiştirin:

```json
"scorer": {
  "chain": [
    { "provider": "groq", "model": "qwen/qwen4-32b" },
    { "provider": "groq", "model": "openai/gpt-oss-20b", "params": { "reasoning_effort": "low" }, "maxTokens": 1000 },
    { "provider": "cloudflare", "model": "@cf/mistralai/mistral-small-3.1-24b-instruct" },
    { "provider": "cloudflare", "model": "@cf/meta/llama-4-scout-17b-16e-instruct" }
  ]
}
```

Yeni Groq modelinin dakikalık sınırlarını da `providers.groq.perMinuteLimits` altına ekleyin (bilmiyorsanız `default` satırı kullanılır).

Model adını sağlayıcının model sayfasından **birebir** kopyalayın (Groq: console.groq.com/docs/models, Cloudflare: developers.cloudflare.com/workers-ai/models).

Kapatılan bir model için ayrıca acele etmenize gerek yok. Sağlayıcı "model kapatıldı / bulunamadı / deprecated" derse (HTTP 404, 410 ya da mesajda "deprecated") hat kendiliğinden zincirdeki sıradaki modele geçer, o model o run'da bir daha denenmez ve bir `model_unavailable` olayı kaydedilir. Run sonunda bu olaylar sonuç dosyasında `stats.modelEvents` altında listelenir ve log'a `[v2-process] model olayı: model_unavailable cloudflare/... (HTTP 410)` satırı düşer. Config'i düzeltmek kalıcı çözümdür: Cloudflare'de yeni model seçerken model sayfasında "Deprecated" satırı **olmayan** bir model seçin.

#### Örnek: yedek model nasıl eklenir

Doğrulayıcıya üçüncü bir yedek eklemek için zincirin sonuna yeni bir satır ekleyin (aşağıdaki model adı örnektir, sağlayıcının sayfasından gerçek adı alın). Önceki satırın sonuna virgül koymayı unutmayın:

```json
"verifier": {
  "chain": [
    { "provider": "cloudflare", "model": "@cf/mistralai/mistral-small-3.1-24b-instruct" },
    { "provider": "cloudflare", "model": "@cf/google/gemma-4-26b-a4b-it", "params": { "chat_template_kwargs": { "enable_thinking": false } } },
    { "provider": "gemini", "model": "gemini-3.5-flash-lite" },
    { "provider": "gemini", "model": "gemma-4-31b-it" }
  ]
}
```

Kullanılabilecek sağlayıcılar şimdilik `groq`, `cloudflare` ve `gemini`. Yeni bir sağlayıcı (ör. OpenRouter) eklemek kod değişikliği ister.

Doğrulayıcı zincirine yazarla aynı aileden model koymayın. Yazar OpenAI ailesi (gpt-oss), doğrulayıcı Mistral / Google ailesi (Mistral Small, Gemma, Gemini). Aynı aile kendi hatasını daha zor yakalar.

#### Yazar zinciri

Yazar modelleri sırayla denenir: önce `groq / openai/gpt-oss-120b`, o dolarsa `groq / openai/gpt-oss-20b`, o da dolarsa `gemini / gemini-3.5-flash-lite`. Cloudflare yazar zincirinde bilerek yoktur: bir run'da ~3.550 Neuron yakıp günlük 10.000 Neuron'luk ortak kotayı bitiriyordu; bu kota tekrar kontrolü (embedding) ve doğrulayıcı için ayrılır. Kör testte kullanıcı 120b'nin yazdığı kartı en çok seçti (15 bilgide 8 kez), bu yüzden ilk sırada o var. 120b'nin günlük limiti (200K token) dolunca hat otomatik olarak 20b'ye geçer.

`params` isteğe bağlıdır; modele giden ek ayarlardır. `reasoning_effort: "low"` modelin "düşünme" kısmını kısa tutar, böylece daha az token harcanır.

#### `sameAs`

```json
"judge": { "sameAs": "scorer" }
```

Hakem, puanlayıcıyla aynı zinciri kullanır (kendi `maxTokens` değeri ayrı yazılabilir: `"judge": { "sameAs": "scorer", "maxTokens": 200 }`). Puanlayıcının modelini değiştirdiğinizde hakemin modeli de değişir. Hakeme ayrı bir zincir vermek isterseniz `sameAs` satırını silip yerine `chain` yazın.

#### `embedding`

- `dimensions`: vektör boyutu (bge-m3 için 1024). Veritabanındaki `vector(1024)` sütunuyla aynı olmalı.
- `batchSize`: tek istekte kaç metin gönderileceği.

Embedding modelini değiştirmek **ciddi bir iştir**. Farklı modellerin vektörleri birbiriyle karşılaştırılamaz; tüm eski kartların vektörleri yeniden hesaplanmalıdır. Bu yüzden embedding zincirine farklı bir modeli "yedek" olarak eklemeyin.

### `providers`: sağlayıcı ayarları ve günlük sınırlar

Her sağlayıcı için:

| Alan | Anlamı |
|---|---|
| `baseUrl` | Sağlayıcının API adresi. Değiştirmeyin. |
| `apiKeyEnv` | Anahtarın durduğu ortam değişkeninin **adı** (anahtarın kendisi değil). Groq: `GROQ_API_KEY`, Cloudflare: `CLOUDFLARE_API_TOKEN`, Gemini: `GEMINI_API_KEY`. |
| `accountIdEnv` | Sadece Cloudflare: hesap kimliğinin durduğu ortam değişkeni (`CLOUDFLARE_ACCOUNT_ID`). |
| `jsonMode` | Sağlayıcının "sadece JSON döndür" modu açılsın mı. Kapalıysa hat yanıttaki JSON'u kendisi ayıklar, bozuksa modelden bir kez düzeltmesini ister. |
| `dailyLimits` | Günlük üst sınırlar (aşağıda). |
| `stopAtPercent` | Sınırın yüzde kaçında durulacağı. `90`: sınırın %90'ına gelince o sağlayıcı (ya da model) o gün için bırakılır. Kalan %10 hata payıdır. |

`dailyLimits` iki türlü yazılır:

- `perModel`: sınır her model için ayrı sayılır. Groq böyle çalışır: `{ "requests": 1000, "tokens": 200000 }` = her model için günde 1.000 istek ve 200.000 token.
- `provider`: sınır sağlayıcının tüm modelleri için ortaktır. Cloudflare böyle çalışır: `{ "neurons": 10000 }` = tüm modeller toplam günde 10.000 Neuron.

Bir sınırı bilmiyorsanız `null` yazabilirsiniz; o zaman o ölçüt sayılır ama sınır uygulanmaz (sağlayıcı "çok istek" hatası verince hat yine yedeğe geçer).

#### `perMinuteLimits`: dakikalık sınırlar (Groq)

Groq'un ücretsiz katmanında günlük sınırların yanında **dakikalık** sınırlar da var:

| Alan | Anlamı |
|---|---|
| `tokensPerMinute` | TPM: son 60 saniyede girdi + çıktı toplam token. Groq tablosunda 8.000. |
| `outputTokensPerMinute` | OTPM: son 60 saniyede sadece **çıktı** token. Konsol tablosunda görünmeyebilir; Groq hata mesajında yazar ("output tokens per minute (OTPM): Limit 1000"). |

```json
"perMinuteLimits": {
  "qwen/qwen3.8-27b": { "tokensPerMinute": 8000, "outputTokensPerMinute": 1000 },
  "default": { "tokensPerMinute": 8000, "outputTokensPerMinute": 1000 }
}
```

Hat her model için son 60 saniyede harcananı sayar. Yeni istek sınırı aşacaksa pencere açılana kadar bekler (en fazla 60 saniye). Groq yine de "çok istek" (429) derse mesajdaki "try again in 6.5s" süresine uyar ve mesajdaki "Limit N" değerini o run için o modelin sınırı olarak kullanır. Groq "Request too large" derse (tek istek sınırdan büyük) puanlayıcı grubu otomatik olarak **ikiye bölünür** ve tekrar denenir. Bekleme ve bölmeler sonuç dosyasında `stats.rateEvents` altında görünür.

`gpt-oss` modellerinin OTPM değeri yayınlanmıyor; şimdilik qwen ile aynı (1000) varsayıldı. Groq konsolunun Limits sayfasında TPM'in üstüne gelince "X in / Y out" görüyorsanız oradaki değeri yazın. Bilmiyorsanız `null` yazın (o ölçüt uygulanmaz).

Örnek: Groq konsolunda gerçek günlük token sınırınızın 500.000 olduğunu gördünüz:

```json
"perModel": { "requests": 1000, "tokens": 500000 }
```

Gemini'nin ücretsiz sınırları Google tarafından yayınlanmıyor. Config'teki `requests: 200` temkinli bir tahmindir. AI Studio'daki "Rate limit" sayfasından gerçek değeri okuyup güncelleyin.

`neuronsPerMillionTokens` (sadece Cloudflare): Cloudflare kullanımı Neuron cinsinden ölçer, yanıtta ise token sayısı gelir. Hat token'ı bu tabloyla Neuron'a çevirerek tahmin eder. Değerler Cloudflare fiyat sayfasından alınmıştır. Tabloda olmayan model için `default` satırı (bilerek pahalı tutuldu) kullanılır. Cloudflare'de yeni bir model kullanacaksanız buraya satırını ekleyin.

Günlük sayaçlar UTC gününe göre tutulur (Cloudflare da 00:00 UTC'de sıfırlar). Yerel çalışmada sayaçlar `packages/pipeline/.cache/llm-usage-YYYY-MM-DD.json` dosyasına yazılır; bu klasör git'e girmez.

### `retry`: hata olunca tekrar deneme

| Alan | Varsayılan | Anlamı |
|---|---|---|
| `maxAttempts` | `3` | "Çok istek" (429), sunucu hatası (5xx) ya da zaman aşımında aynı model en fazla kaç kez denenir. Sonra zincirde sıradakine geçilir. |
| `baseDelayMs` | `2000` | İlk tekrar öncesi bekleme (milisaniye; 2000 = 2 saniye). Her denemede ikiye katlanır: 2 sn, 4 sn, 8 sn… Sağlayıcı "şu kadar bekle" derse ona uyulur. |
| `maxDelayMs` | `30000` | Bir beklemenin üst sınırı (30 saniye). |
| `requestTimeoutMs` | `60000` | Tek isteğin en fazla ne kadar süreceği (60 saniye). Aşarsa iptal edilip tekrar denenir. |

Sağlayıcı "günlük kotanız bitti" derse (ör. Groq "tokens per day") boşuna tekrar denenmez; o model o gün için kapatılır ve sıradakine geçilir.

### `scoring`, `writing`, `dedup`, `publish`: hat eşikleri

| Alan | Varsayılan | Anlamı |
|---|---|---|
| `scoring.batchSize` | `10` | Puanlayıcıya tek seferde kaç aday gönderilir. 10 adayın yanıtı ≈ 400 token; Groq'un dakikalık çıktı sınırına (1000) sığar. Artırırsanız `roles.scorer.maxTokens` ve `expectedOutputTokens`'ı da artırmanız gerekir. |
| `scoring.passPercent` | `30` | Puanlanan adayların en iyi yüzde kaçı yazıma geçer. |
| `scoring.minSurprise` | `6` | Şaşırtıcılık puanı (0–10) bunun altındaysa aday elenir (`low_surprise`). Kartlar yeterince "Aa!" dedirtmiyorsa artırın. |
| `scoring.minTrRelevance` | `4` | Türk okur için ilgi puanı (0–10) bunun altındaysa aday elenir (`low_relevance`). |
| `writing.minSentences` | `3` | Kart gövdesi en az kaç cümle olmalı (1–10). Daha az cümleli kart bir kez yeniden yazdırılır, yine kısaysa elenir (`write_rules`). |
| `writing.maxSentences` | `5` | Kart gövdesi en fazla kaç cümle olabilir (1–10, `minSentences`'tan küçük olamaz). Kısa kart daha az yorum cümlesi ve daha az doğrulama reddi demektir. |
| `dedup.duplicateThreshold` | `0.92` | İki kartın benzerliği (0–1) bunun üstündeyse yeni kart "tekrar" sayılır ve elenir. |
| `dedup.grayZoneLow` | `0.85` | Benzerlik bu değer ile `duplicateThreshold` arasındaysa "gri bölge"dir; hakeme sorulur. |
| `publish.dailyCount` | `100` | Günde kaç kart yayınlanır. |
| `publish.minStockDays` | `7` | Yayın stoğunda en az kaç günlük kart bekletilmeye çalışılır. |

#### Örnek: günlük kart sayısı nasıl değiştirilir

İlk birikim bitti ve günde 40 kart yayınlamak istiyorsunuz:

```json
"publish": {
  "dailyCount": 40,
  "minStockDays": 7
}
```

Stok hedefi gün cinsindendir. `dailyCount` 40 ve `minStockDays` 7 ise hat stokta en az 280 kart tutmaya çalışır.

### Geliştiriciler için

Kod `src/llm/` altındadır:

```js
import { createLlm, loadConfig, createFileUsageStore } from './src/llm/index.js';

const llm = createLlm(loadConfig(), { usageStore: createFileUsageStore() });
const { json, provider, model, usage } = await llm.chat('scorer', { messages, json: true, maxTokens: 800 });
const { vectors } = await llm.embed(['metin 1', 'metin 2']);
// llm.events: model_unavailable, budget_skip, quota_exhausted, retry, json_repair,
//             rate_wait, rate_limit_learned, request_too_large ... olayları
```

Zincir tükenirse `LlmExhaustedError` fırlatılır; işi ertesi güne bırakmak çağıranın kararıdır. Modeller çalıştı ama hepsi bozuk çıktı verdiyse `LlmOutputError` fırlatılır (adımlar bunu aday hatası sayar). `maxTokens` verilmezse `roles.<rol>.maxTokens` kullanılır; zincir üyesinin kendi `maxTokens`'ı varsa o önceliklidir. `chat(..., { splittable: true })` verilirse "Request too large" durumunda zincirde ilerlemek yerine `LlmRequestTooLargeError` fırlatılır; çağıran işi bölüp tekrar dener (puanlayıcı böyle yapar).

Kart başlığı kodda da düzeltilir: ilk harf büyük yapılır (Türkçe kuralıyla: "istanbul" → "İstanbul") ve sondaki nokta silinir.

Testler (gerçek API çağrısı yapmaz):

```
node --test "packages/pipeline/src/llm/**/*.test.js"
```

## Otomatik çalışma (GitHub Actions)

Hat GitHub'da kendiliğinden çalışır; bilgisayarınızın açık olması gerekmez. Üç workflow var:

| Workflow | Ne zaman (İstanbul saati) | Ne yapar |
|---|---|---|
| `content-v2` | Her gün 06:17, 14:17, 22:17 | Yeni kancaları toplar, puanlar, kartları yazar, doğrular ve yayın stoğuna ekler. 22:17 run'ı, yayın anahtarı açıksa (aşağıya bakın) günün kartlarını da yayınlar. Bir sorun görürse GitHub Issue açar. |
| `content-v2-weekly-sample` | Her pazartesi 10:00 | Geçen hafta yayınlanan kartlardan rastgele 10 tanesini değerlendirmeniz için Issue olarak açar. |
| `keepalive` | Her ayın 1'i | GitHub uzun süre hareketsiz kalan depolarda zamanlanmış workflow'ları kapatabilir. Bu workflow onları yeniden "etkin" yapar. Başka hiçbir şey yapmaz. |

Her run'da adımlar sondan başa çalışır: önce bekleyen taslaklar doğrulanıp stoğa eklenir, sonra yeni kancalar işlenir ve yazılır. Bekleyen taslak sayısı `pipeline.config.json` içindeki `writing.maxWrittenBacklog` değerini (varsayılan 40) aşarsa o run'da yeni taslak yazılmaz; böylece günlük yazar kotası doğrulamaya kalır.

Eski hat (`facts-ingest`) artık kendiliğinden çalışmaz; sadece elle çalıştırılabilir.

### Hattı açmak (bir kerelik)

Workflow dosyaları `main` dalına geldikten sonra hat **kapalı** başlar. Zamanlanmış run'lar listede "Skipped" (atlandı) görünür. Açmak için:

1. **Anahtarları kontrol edin.** GitHub'da depoyu açın → üstte **Settings** → sol menüde **Secrets and variables** → **Actions** → **Secrets** sekmesi. Şu altı secret listede olmalı (yoksa **New repository secret** ile ekleyin; adı birebir aynı yazılmalı):
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `GEMINI_API_KEY`
2. Aynı sayfada **Variables** sekmesine geçin → **New repository variable**.
3. **Name** kutusuna `CONTENT_V2_ENABLED`, **Value** kutusuna `true` yazın (küçük harf) → **Add variable**.

Bu kadar. Bir sonraki planlı saatte hat çalışmaya başlar. Kartlar üretilir ama **yayınlanmaz**; yayın ayrı bir anahtardır.

### İki anahtar

| Değişken adı | Ne açar | Varsayılan |
|---|---|---|
| `CONTENT_V2_ENABLED` | Üretim: toplama, puanlama, yazma, doğrulama. | Kapalı (değişken yok) |
| `CONTENT_V2_AUTO_PUBLISH` | Yayın: günün son run'ında (22:17) günlük adet (`publish.dailyCount`, şu an 10) kart yayınlanır. | Kapalı (değişken yok) |

Her ikisi de aynı yerden açılır: GitHub'da depo → **Settings** → **Secrets and variables** → **Actions** → **Variables** sekmesi → **New repository variable**. **Name** kutusuna değişken adını, **Value** kutusuna `true` (küçük harf) yazıp **Add variable**'a basın. `true` dışında bir değer ya da değişkenin olmaması "kapalı" demektir.

İlk günlerde yalnız `CONTENT_V2_ENABLED` açık kalsın, kartları inceleyip elle yayınlayın (Actions → `content-v2` → **Run workflow** → `publish` kutusu; elle çalıştırma bu anahtardan etkilenmez). Güvendiğinizde `CONTENT_V2_AUTO_PUBLISH` değişkenini `true` yapın. Yayını durdurmak için değişkeni silin ya da `false` yapın. Elle yayında `dailyCount` kullanılmaz.

**Kapatmak için:** aynı yerde `CONTENT_V2_ENABLED` değişkenini düzenleyip değerini `false` yapın (ya da silin). Elle çalıştırma kapalıyken de çalışır.

Not: Hat çalışmadan önce v2 veritabanı tabloları (`fact_candidates`, `pipeline_state`, `pipeline_runs`) Supabase'te kurulmuş olmalı.

### Elle çalıştırma

1. GitHub'da depo → üstte **Actions**.
2. Sol listede **content-v2**.
3. Sağda **Run workflow** düğmesi → açılan kutuda:
   - **mode**: `dry-run` = deneme; veritabanına hiçbir şey yazmaz (yapay zeka çağrıları yine gerçektir ve günlük ücretsiz kotadan yer). `apply` = gerçek çalışma.
   - **publish**: işaretlerseniz günün kartları da yayınlanır (sadece `apply` ile anlamlı).
4. Yeşil **Run workflow** düğmesine basın. Birkaç saniye sonra listede yeni run görünür; tıklayınca log'u ve sonunda kısa bir özet görürsünüz.

Haftalık örneği de aynı yoldan elle açabilirsiniz: **content-v2-weekly-sample** → **Run workflow**.

### Alarm Issue'ları ne anlama gelir?

Hat bir sorun görünce `pipeline-alarm` etiketli bir Issue açar; GitHub size e-posta gönderir. Açık bir alarm Issue'su varken yeni alarmlar **yeni Issue açmak yerine ona yorum olarak** eklenir. Sorun çözülünce Issue'yu kapatın; sonraki sorun yeni bir Issue açar.

Her Issue'da "Ne oldu?" ve "Ne yapmalısınız?" yazar. Olası başlıklar:

| Başlık | Anlamı | Ne yapmalı |
|---|---|---|
| Yeni kart çıkmadı | Bu run'da stoğa hiç kart eklenmedi. | Tek seferlik olabilir. Birkaç run üst üste geliyorsa aynı Issue'daki diğer maddelere bakın. |
| Stok azaldı | Yayın stoğu 3 günlük kartın altına düştü. | Hat yayınladığından az üretiyor. Kısa vadede `publish.dailyCount` düşürülebilir (yukarıda "Örnek: günlük kart sayısı nasıl değiştirilir"). |
| Model kapanmış | Bir yapay zeka modeli "kapatıldı / bulunamadı" dedi. Hat kendiliğinden yedeğe geçti. | Config'te o modeli değiştirin (yukarıda "Örnek: model nasıl değiştirilir"). Yedek de kapanırsa üretim durur. |
| Model zinciri tükendi | Bir işin (ör. yazar) bütün modelleri o run'da doldu ya da hata verdi; kalan iş sonraki run'a kaldı. | Genelde günlük ücretsiz limittir, ertesi gün düzelir. Her gün oluyorsa anahtarları ve sağlayıcı limitlerini kontrol edin. |
| Run hata ile bitti | Bir adım hata verdi (ör. Wikipedia'ya ulaşılamadı, anahtar eksik). | Issue'daki "run kaydı" bağlantısından log'a bakın. Çoğu zaman bir sonraki run'da düzelir. |
| Run özet üretemeden durdu | Kurulum adımı hata verdi ya da run 2 saati aştı. | Run kaydında kırmızı adımın log'una bakın. |

Deneme (`dry-run`) çalıştırmalarında Issue açılmaz; alarmlar sadece run sayfasındaki özette görünür.

Her gerçek run'ın sayıları (kaç aday, kaç kart, red nedenleri, model kullanımı, süre) Supabase'te `pipeline_runs` tablosuna da yazılır. Günlük yapay zeka kullanımı `pipeline_state` tablosunda `llm-usage:YYYY-AA-GG` satırında tutulur; böylece günün üç run'ı aynı ücretsiz kotayı paylaşır ve sınırın %90'ında durur.

### Haftalık örnek nasıl değerlendirilir?

Her pazartesi `weekly-sample` etiketli bir Issue gelir: 10 kart, her birinin başında bir kutu, başlığı, metni ve kaynak linki.

1. Kartları okuyun. Şüphelendiğiniz bilgiyi kaynak linkinden kontrol edebilirsiniz.
2. **Kötü** bulduğunuz kartın kutusunu işaretleyin. Kötü kart: yanlış bilgi, sıkıcı ya da "X nedir" tarzı, bozuk Türkçe, başlığı metinle uyuşmuyor.
3. Nedenini kısaca Issue'ya yorum olarak yazın (ör. "3: tarih yanlış", "7: sıkıcı").
4. Bitince Issue'yu kapatın.

Hedef: 10 karttan en az 8'i iyi ve **hiç yanlış bilgi yok**. İşaretlenen kartlar yazar istemini ve puan eşiklerini ayarlamak için kullanılır.

### Komut satırından (geliştiriciler)

```
node src/runners/v2-daily.js                                  # dry-run: DB'ye yazmaz (LLM ve Wikipedia çağrıları gerçek)
node src/runners/v2-daily.js --mode apply --publish           # gerçek run + yayın
node src/runners/v2-daily.js --collect-limit 300 --process-limit 300 --backfill-from 2024-02 --backfill-months 1
node src/runners/v2-weekly-sample.js                          # haftalık örnek metnini ekrana basar (Issue açmaz)
```

`v2-daily.js` stdout'a sadece tek satır JSON özet yazar (`ok`, adım sayıları, `alarms`, `issue`); log stderr'e gider. Çıkış kodu: 0 = hatasız (alarm olsa bile), 1 = bir adım hata verdi.
