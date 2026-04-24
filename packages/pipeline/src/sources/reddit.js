// src/sources/reddit.js
// Reddit JSON API'sinden en iyi (upvoted) AskHistorians ve r/science
// cevaplarını çeker. Key gerektirmez (public JSON endpoint).

const SUBREDDITS = [
  { sub: 'AskHistorians', category: 'history', sort: 'top', time: 'month' },
  { sub: 'ExplainLikeImFive', category: 'science', sort: 'top', time: 'week' },
  { sub: 'philosophy', category: 'philosophy', sort: 'top', time: 'month' },
  { sub: 'science', category: 'science', sort: 'top', time: 'month' },
  { sub: 'Showerthoughts', category: 'philosophy', sort: 'top', time: 'week' },
];

/**
 * Reddit'ten her subreddit için en iyi postları çeker.
 * @param {number} limitPerSub - Her subreddit'ten kaç post alınacağı
 * @returns {Promise<Array<{title, extract, url, category}>>}
 */
export async function fetchRedditPosts(limitPerSub = 10) {
  const results = [];

  for (const { sub, category, sort, time } of SUBREDDITS) {
    try {
      const url = `https://www.reddit.com/r/${sub}/${sort}.json?t=${time}&limit=${limitPerSub}`;

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'SmartScrolling-Pipeline/1.0',
        },
      });

      if (!res.ok) {
        console.warn(`[Reddit] r/${sub} yanıt vermedi: ${res.status}`);
        continue;
      }

      const json = await res.json();
      const posts = json?.data?.children ?? [];

      for (const { data: post } of posts) {
        // Çok kısa postları, yorumsuzları ve NSFW içerikleri atla
        if (post.over_18 || post.num_comments === 0) continue;

        let extract = post.selftext || '';

        // Sadece soru olan yerler (AskHistorians vb) için en iyi cevabı (top comment) bul
        try {
          const commentUrl = `https://www.reddit.com${post.permalink}.json?sort=top`;
          const commentRes = await fetch(commentUrl, {
            headers: { 'User-Agent': 'SmartScrolling-Pipeline/1.0' },
          });
          const commentJson = await commentRes.json();
          // Reddit thread JSON: [0] is post info, [1] is comments tree
          const topComment = commentJson[1]?.data?.children?.[0]?.data?.body;

          if (topComment && topComment !== '[deleted]' && topComment.length > 100) {
            extract = `Soru: ${post.title}\n\nDetaylı Cevap/Bilgi: ${topComment}`;
          }
        } catch (err) {
          console.warn(`    [Reddit] Yorum çekilemedi: ${post.title}`);
        }

        if (!extract || extract.length < 200) continue;

        results.push({
          title: post.title,
          extract: post.selftext,
          url: `https://www.reddit.com${post.permalink}`,
          sourceLabel: `Reddit r/${sub}`,
          category,
          imageUrl: buildUnsplashUrl(post.title, category),
        });
      }

      // Reddit rate limit'e takılmamak için kısa bekleme
      await sleep(1000);
    } catch (err) {
      console.error(`[Reddit] r/${sub} hatası:`, err.message);
    }
  }

  return results;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function buildUnsplashUrl(title, category) {
  const keywords = `${title.split(' ').slice(0, 2).join(',')},${category}`;
  return `https://source.unsplash.com/800x1200/?${encodeURIComponent(keywords)}`;
}
