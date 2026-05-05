create table if not exists public.ai_content_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  book_id uuid references public.books(id) on delete set null,
  book_title text,
  assistant_message text not null,
  reason text not null check (
    reason in (
      'wrong_information',
      'harmful_or_uncomfortable',
      'out_of_book_context',
      'other'
    )
  ),
  note text,
  created_at timestamptz not null default now()
);

alter table public.ai_content_reports enable row level security;

create policy "Anyone can create ai content reports"
  on public.ai_content_reports
  for insert
  with check (user_id is null or auth.uid() = user_id);
