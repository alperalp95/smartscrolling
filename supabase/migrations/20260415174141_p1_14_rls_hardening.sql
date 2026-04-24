drop policy if exists "Users can manage their own progress" on public.reading_progress;
drop policy if exists "Users can manage their own bookmarks" on public.bookmarks;
drop policy if exists "Users can manage their own chat sessions" on public.chat_sessions;
drop policy if exists "Users can manage their own activity" on public.user_activity;

create policy "Users can read their own progress"
on public.reading_progress
for select
using (auth.uid() = user_id);

create policy "Users can insert their own progress"
on public.reading_progress
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own progress"
on public.reading_progress
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own progress"
on public.reading_progress
for delete
using (auth.uid() = user_id);

create policy "Users can read their own bookmarks"
on public.bookmarks
for select
using (auth.uid() = user_id);

create policy "Users can insert their own bookmarks"
on public.bookmarks
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own bookmarks"
on public.bookmarks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own bookmarks"
on public.bookmarks
for delete
using (auth.uid() = user_id);

create policy "Users can read their own chat sessions"
on public.chat_sessions
for select
using (auth.uid() = user_id);

create policy "Users can insert their own chat sessions"
on public.chat_sessions
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own chat sessions"
on public.chat_sessions
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own chat sessions"
on public.chat_sessions
for delete
using (auth.uid() = user_id);

create policy "Users can read their own activity"
on public.user_activity
for select
using (auth.uid() = user_id);

create policy "Users can insert their own activity"
on public.user_activity
for insert
with check (auth.uid() = user_id);

create policy "Users can update their own activity"
on public.user_activity
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete their own activity"
on public.user_activity
for delete
using (auth.uid() = user_id);
