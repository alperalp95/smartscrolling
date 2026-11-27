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
