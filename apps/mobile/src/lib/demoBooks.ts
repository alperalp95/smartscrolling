export type DemoBook = {
  id: string;
  emoji: string;
  title: string;
  author: string;
  bg: string;
  premium: boolean;
  progress?: number;
};

export const DEMO_BOOKS: DemoBook[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    emoji: '📘',
    title: 'Kendime Dusunceler',
    author: 'Marcus Aurelius',
    bg: '#1a1a2e',
    premium: false,
    progress: 65,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    emoji: '🎨',
    title: 'Kurk Mantolu Madonna',
    author: 'Sabahattin Ali',
    bg: '#1a0d0a',
    premium: true,
    progress: 12,
  },
];

export const CONTINUE_BOOKS = DEMO_BOOKS.filter(
  (book): book is DemoBook & { progress: number } => typeof book.progress === 'number',
);

export function getDemoBookById(bookId: string) {
  return DEMO_BOOKS.find((book) => book.id === bookId) ?? null;
}
