// src/sources/nasa.js
// NASA APOD (Astronomy Picture of the Day) API'sinden son N günün
// astronomi/uzay bilgilerini çeker. Bilim kategorisi için mükemmel.
// 🔑 KEY GEREKLİ: https://api.nasa.gov/ adresinden ücretsiz alınır.

const NASA_BASE = 'https://api.nasa.gov/planetary/apod';

/**
 * NASA APOD API'sinden son {count} günün astronomi bilgilerini çeker.
 * @param {number} count - Kaç gün geriye gidileceği (max 100 free tier)
 * @returns {Promise<Array<{title, extract, url}>>}
 */
export async function fetchNasaApod(count = 30) {
  const apiKey = process.env.NASA_API_KEY;

  if (!apiKey || apiKey === 'your_nasa_api_key_here') {
    console.warn('[NASA] ⚠️  NASA_API_KEY eksik. https://api.nasa.gov/ adresinden ücretsiz alın.');
    return [];
  }

  try {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - count);

    const url = new URL(NASA_BASE);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('start_date', startDate.toISOString().split('T')[0]);
    url.searchParams.set('end_date', today.toISOString().split('T')[0]);
    url.searchParams.set('thumbs', 'true');

    const res = await fetch(url.toString());
    if (!res.ok) {
      console.error('[NASA] API yanıt hatası:', res.status);
      return [];
    }

    const data = await res.json();

    return data
      .filter((item) => item.media_type === 'image' && item.explanation?.length > 100)
      .map((item) => ({
        title: item.title,
        extract: item.explanation,
        url: `https://apod.nasa.gov/apod/ap${item.date.replace(/-/g, '').substring(2)}.html`,
        sourceLabel: `NASA APOD · ${item.date}`,
        category: 'science',
        imageUrl: item.hdurl || item.url,
      }));
  } catch (err) {
    console.error('[NASA] Fetch hatası:', err.message);
    return [];
  }
}
