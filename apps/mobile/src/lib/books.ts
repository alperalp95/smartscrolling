import { useAuthStore } from '../store/authStore';
import type { BookRow, BookType } from '../types';
import { supabase } from './supabase';

export type BookAccessState = {
  badgeLabel: string;
  canRead: boolean;
  ctaLabel: string;
  helperText: string;
  isFreeAnchor: boolean;
  needsAuth: boolean;
  needsPremium: boolean;
};

export const FALLBACK_BOOKS: BookType[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Kendime Dusunceler',
    author: 'Marcus Aurelius',
    coverUrl: null,
    description:
      'Stoaci dusunce, oz disiplin ve zihinsel berraklik uzerine yazilmis kisa ama yogun notlar. Uygulamanin serbest anchor metni olarak kullanilir.',
    category: 'Felsefe',
    totalPages: 160,
    epubUrl: 'https://www.gutenberg.org/ebooks/2680',
    isPremium: false,
    accessTier: 'free_anchor',
    language: 'en',
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    title: 'The Problems of Philosophy',
    author: 'Bertrand Russell',
    coverUrl: null,
    description:
      'Bilginin sinirlari, gerceklik ve felsefi sorusturma uzerine acik ve ogretici bir giris metni.',
    category: 'Felsefe',
    totalPages: 160,
    epubUrl: 'https://www.gutenberg.org/ebooks/5827',
    isPremium: true,
    accessTier: 'premium',
    language: 'en',
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    title: 'On Liberty',
    author: 'John Stuart Mill',
    coverUrl: null,
    description:
      'Bireysel ozgurluk, devlet sinirlari ve toplumsal baski uzerine klasik bir siyaset felsefesi metni.',
    category: 'Felsefe',
    totalPages: 220,
    epubUrl: 'https://www.gutenberg.org/ebooks/34901',
    isPremium: true,
    accessTier: 'premium',
    language: 'en',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    title: 'Common Sense',
    author: 'Thomas Paine',
    coverUrl: null,
    description:
      'Amerikan bagimsizlik dusuncesini halk diliyle savunan, tarihsel ve siyasal etkisi yuksek bir metin.',
    category: 'Tarih',
    totalPages: 96,
    epubUrl: 'https://www.gutenberg.org/ebooks/147',
    isPremium: true,
    accessTier: 'premium',
    language: 'en',
  },
  {
    id: '55555555-5555-5555-5555-555555555555',
    title: 'The Republic',
    author: 'Plato',
    coverUrl: null,
    description:
      'Adalet, devlet duzeni ve ideal toplum fikrini tartisan temel bir felsefe klasigi.',
    category: 'Felsefe',
    totalPages: 360,
    epubUrl: 'https://www.gutenberg.org/ebooks/1497',
    isPremium: true,
    accessTier: 'premium',
    language: 'en',
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    title: 'The Prince',
    author: 'Niccolo Machiavelli',
    coverUrl: null,
    description:
      'Iktidar, liderlik ve devlet yonetimi uzerine siyasal gercekligi merkeze alan etkili bir metin.',
    category: 'Siyaset',
    totalPages: 140,
    epubUrl: 'https://www.gutenberg.org/ebooks/1232',
    isPremium: true,
    accessTier: 'premium',
    language: 'en',
  },
  {
    id: '77777777-7777-7777-7777-777777777777',
    title: 'Relativity: The Special and General Theory',
    author: 'Albert Einstein',
    coverUrl: null,
    description:
      'Einsteinin gorelilik kuramini genis kitlelere anlatmak icin yazdigi bilimsel aciklama metni.',
    category: 'Bilim',
    totalPages: 180,
    epubUrl: 'https://www.gutenberg.org/ebooks/5001',
    isPremium: true,
    accessTier: 'premium',
    language: 'en',
  },
  {
    id: '88888888-8888-8888-8888-888888888888',
    title: 'The Voyage of the Beagle',
    author: 'Charles Darwin',
    coverUrl: null,
    description:
      'Dogal gozlem, kesif ve evrimsel dusuncenin erken sekillenisi icin guclu bir bilim tarihi kaynagi.',
    category: 'Bilim',
    totalPages: 480,
    epubUrl: 'https://www.gutenberg.org/ebooks/944',
    isPremium: true,
    accessTier: 'premium',
    language: 'en',
  },
  {
    id: '99999999-9999-9999-9999-999999999999',
    title: 'A Short History of the World',
    author: 'H. G. Wells',
    coverUrl: null,
    description:
      'Uygarliklarin, savaslarin ve dunyanin donusumunun hizli ama kapsayici bir tarih anlatimi.',
    category: 'Tarih',
    totalPages: 420,
    epubUrl: 'https://www.gutenberg.org/ebooks/35461',
    isPremium: true,
    accessTier: 'premium',
    language: 'en',
  },
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    title: 'The Souls of Black Folk',
    author: 'W. E. B. Du Bois',
    coverUrl: null,
    description:
      'Irk, toplum, egitim ve modernlik uzerine tarihsel ve sosyolojik derinligi yuksek bir klasik.',
    category: 'Toplum',
    totalPages: 240,
    epubUrl: 'https://www.gutenberg.org/ebooks/408',
    isPremium: true,
    accessTier: 'premium',
    language: 'en',
  },
];

type BooksListResult = {
  data: BookRow[] | null;
  error: { message: string } | null;
};

type BookSingleResult = {
  data: BookRow | null;
  error: { message: string } | null;
};

async function withTimeout<T>(promise: PromiseLike<T>, fallback: T, timeoutMs = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]);
}

function mapBookRow(row: BookRow): BookType {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    coverUrl: row.cover_url,
    description: row.description,
    category: row.category,
    totalPages: row.total_pages,
    epubUrl: row.epub_url,
    isPremium: row.is_premium ?? false,
    accessTier: row.access_tier ?? 'premium',
    language: row.language,
  };
}

export function resolveBookAccess(
  book: Pick<BookType, 'accessTier' | 'isPremium'>,
  options?: {
    hasPremium?: boolean;
    isAuthenticated?: boolean;
  },
): BookAccessState {
  const isAuthenticated = options?.isAuthenticated ?? false;
  const hasPremium = options?.hasPremium ?? false;
  const accessTier = book.accessTier ?? (book.isPremium ? 'premium' : 'free_anchor');

  if (accessTier === 'free_anchor') {
    return {
      badgeLabel: 'FREE',
      canRead: true,
      ctaLabel: 'Okumaya Basla',
      helperText: 'Bu metin tum kullanicilar icin serbest okunabilir.',
      isFreeAnchor: true,
      needsAuth: false,
      needsPremium: false,
    };
  }

  if (!isAuthenticated) {
    return {
      badgeLabel: 'PREMIUM',
      canRead: false,
      ctaLabel: 'Giris Yap',
      helperText: 'Bu premium metni acmadan once giris yapman gerekir.',
      isFreeAnchor: false,
      needsAuth: true,
      needsPremium: false,
    };
  }

  if (!hasPremium) {
    return {
      badgeLabel: 'PREMIUM',
      canRead: false,
      ctaLabel: 'Premium Gerekli',
      helperText: 'Bu metin premium kutuphane katmaninda yer aliyor.',
      isFreeAnchor: false,
      needsAuth: false,
      needsPremium: true,
    };
  }

  return {
    badgeLabel: 'PREMIUM',
    canRead: true,
    ctaLabel: 'Okumaya Basla',
    helperText: 'Premium erisim aktif.',
    isFreeAnchor: false,
    needsAuth: false,
    needsPremium: false,
  };
}

export async function fetchLibraryBooks() {
  const result = await withTimeout(
    supabase
      .from('books')
      .select(
        'id,title,author,cover_url,description,category,total_pages,epub_url,is_premium,language,access_tier',
      )
      .order('created_at', { ascending: true }) as PromiseLike<BooksListResult>,
    { data: null, error: { message: 'timeout' } } as BooksListResult,
  );

  const { data, error } = result;

  if (error) {
    console.error('[Books] fetchLibraryBooks failed:', error.message);
    return FALLBACK_BOOKS;
  }

  if (!data?.length) {
    return FALLBACK_BOOKS;
  }

  return data.map(mapBookRow);
}

export async function fetchContinueBooks(userId?: string | null, hasPremium = false) {
  const fallbackUserId = useAuthStore.getState().user?.id ?? null;
  const resolvedUserId = userId ?? fallbackUserId;

  if (!resolvedUserId) {
    return [];
  }

  const books = await fetchLibraryBooks();
  const { data, error } = await supabase
    .from('reading_progress')
    .select('book_id,current_page,completed')
    .eq('user_id', resolvedUserId)
    .order('last_read_at', { ascending: false });

  if (error || !data?.length) {
    if (error) {
      console.error('[Books] fetchContinueBooks failed:', error.message);
    }

    return [];
  }

  return data
    .map((progressRow) => {
      const book = books.find((item: BookType) => item.id === progressRow.book_id);

      if (
        !book ||
        !resolveBookAccess(book, {
          hasPremium,
          isAuthenticated: true,
        }).canRead
      ) {
        return null;
      }

      const totalPages = Math.max(book.totalPages ?? 1, 1);
      const progress = Math.min(
        100,
        Math.max(1, Math.round(((progressRow.current_page ?? 0) / totalPages) * 100)),
      );

      return {
        ...book,
        progress,
      };
    })
    .filter((book): book is BookType & { progress: number } => Boolean(book));
}

export async function fetchBookById(bookId: string) {
  const result = await withTimeout(
    supabase
      .from('books')
      .select(
        'id,title,author,cover_url,description,category,total_pages,epub_url,is_premium,language,access_tier',
      )
      .eq('id', bookId)
      .maybeSingle() as PromiseLike<BookSingleResult>,
    { data: null, error: { message: 'timeout' } } as BookSingleResult,
  );

  const { data, error } = result;

  if (error) {
    console.error('[Books] fetchBookById failed:', error.message);
  }

  if (!data) {
    return FALLBACK_BOOKS.find((book) => book.id === bookId) ?? null;
  }

  return mapBookRow(data);
}
