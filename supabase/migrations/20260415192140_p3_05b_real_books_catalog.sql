INSERT INTO public.books (
  id,
  title,
  author,
  cover_url,
  description,
  category,
  total_pages,
  epub_url,
  is_premium,
  language
)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Kendime Dusunceler',
    'Marcus Aurelius',
    'https://covers.openlibrary.org/b/olid/OL54790701M-L.jpg',
    'Stoaci imparatorun oz disiplin, erdem ve zihinsel berraklik uzerine notlari. Free katalog icin guclu bir felsefe girisi.',
    'Felsefe',
    160,
    'https://www.gutenberg.org/ebooks/2680',
    false,
    'en'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Ask ve Gurur',
    'Jane Austen',
    'https://covers.openlibrary.org/b/olid/OL6604741M-L.jpg',
    'Jane Austen''in iliski dinamikleri, sinif farklari ve karakter gelisimi uzerine kurulu klasik romani. MVP kutuphanesi icin guclu bir giris kitabi.',
    'Roman',
    432,
    'https://www.gutenberg.org/ebooks/1342',
    false,
    'en'
  )
ON CONFLICT (id) DO UPDATE
SET
  title = EXCLUDED.title,
  author = EXCLUDED.author,
  cover_url = EXCLUDED.cover_url,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  total_pages = EXCLUDED.total_pages,
  epub_url = EXCLUDED.epub_url,
  is_premium = EXCLUDED.is_premium,
  language = EXCLUDED.language;
