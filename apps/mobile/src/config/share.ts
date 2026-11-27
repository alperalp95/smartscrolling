// Paylaşım ayarları. Kod bilmeden düzenlenebilir: sadece tırnak içindeki değerleri değiştirin.
export const SHARE_CONFIG = {
  // Paylaşılan kart linkinin başlangıcı. Link biçimi: <baseUrl>/fact/<kart numarası>.
  // Gerçek alan adı alınınca sadece burayı değiştirin (sonuna "/" koymayın).
  baseUrl: 'https://smartscrolling.app',
  // Paylaşım görselinin altında yazan, kısa ve "https://" içermeyen alan adı.
  displayDomain: 'smartscrolling.app',
  // Kart fotoğrafının yüklenmesi için en çok beklenecek süre (milisaniye).
  // Süre dolarsa fotoğrafsız (yazı) görsel üretilir. 3000 = 3 saniye.
  photoTimeoutMs: 3000,
};
