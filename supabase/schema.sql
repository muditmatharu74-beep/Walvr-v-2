-- Profiles table
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  plan text default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Videos table
create table if not exists videos (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  title text,
  artist text,
  genre text,
  mood text,
  analysis jsonb,
  captions jsonb,
  clip_style text,
  cap_style text,
  template text,
  export_format text default '4k',
  status text default 'pending',
  render_url text,
  render_id text,
  watermarked boolean default true,
  created_at timestamp with time zone default timezone('utc', now())
);

-- Usage table
create table if not exists usage (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  month text not null,
  count integer default 0,
  unique(user_id, month)
);

-- Auto create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS
alter table profiles enable row level security;
alter table videos enable row level security;
alter table usage enable row level security;

create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Users can view own videos"
  on videos for select using (auth.uid() = user_id);

create policy "Users can insert own videos"
  on videos for insert with check (auth.uid() = user_id);

create policy "Users can update own videos"
  on videos for update using (auth.uid() = user_id);

create policy "Users can view own usage"
  on usage for select using (auth.uid() = user_id);
