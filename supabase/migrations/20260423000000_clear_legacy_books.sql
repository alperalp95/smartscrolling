-- Clear all legacy English placeholder books and their dependent data.
-- book_sections, book_highlights, reading_progress, bookmarks are all
-- defined with ON DELETE CASCADE so they will be removed automatically.

DELETE FROM public.books;
