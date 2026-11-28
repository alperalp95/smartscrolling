// Boşluk ve köşe yuvarlaklığı ölçüleri (piksel). Sayıları değiştirerek yerleşimi ayarlayın.
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  screen: 16,
} as const;

export const radius = { sm: 8, md: 12, lg: 18, sheet: 22, full: 999 } as const;

// Seri okuma ekranı: zemindeki renkli ışık lekelerinin çapı ve görünürlüğü (paylaşım görseli dili).
// Kapağın kart yüksekliğine oranı (yalnız seri başındaki ilk kartta) 0-1 arasıdır.
export const reader = {
  glowSize: 260,
  glowOpacity: 0.25,
  coverRatio: 0.3,
} as const;

// Paylaşım görseli ölçüleri (dp). Görsel 360x640 çizilir, 1080x1920 PNG olarak kaydedilir.
export const share = {
  // Görselin genişliği ve yüksekliği.
  width: 360,
  height: 640,
  // Güvenli alan: Instagram/WhatsApp arayüzünün kapatabileceği üst ve alt boşluk.
  safeTop: 56,
  safeBottom: 96,
  // Fotoğraflı görselde fotoğrafın yüksekliği.
  photoHeight: 170,
  // Zemindeki renkli ışık lekelerinin çapı ve görünürlüğü (0 = yok, 1 = tam).
  glowSize: 280,
  glowOpacity: 0.3,
} as const;

// Akıştaki seri tanıtım kartı ölçüleri (dp). Kapağın arkasında iki kart silueti görünür:
// yakın olan daha belirgin, uzak olan dar ve soluktur. Opaklıklar 0 (yok) - 1 (tam) arasıdır.
export const teaser = {
  // Kapak görselinin yüksekliği.
  coverHeight: 256,
  // Siluetler kapağın ARKASINDA, üstten taşar ve yanlardan içeri çekilir.
  // Yakın siluetin kapağın üstünden taşma miktarı, yan girintisi ve görünürlüğü.
  ghostNearRise: 12,
  ghostNearInset: 16,
  ghostNearOpacity: 1,
  // Uzak siluetin taşma miktarı (yakından büyük), yan girintisi ve görünürlüğü.
  ghostFarRise: 24,
  ghostFarInset: 32,
  ghostFarOpacity: 0.6,
} as const;
