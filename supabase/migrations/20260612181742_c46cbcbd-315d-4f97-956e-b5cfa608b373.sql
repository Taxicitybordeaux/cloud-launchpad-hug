
drop policy if exists "read reservation messages" on public.reservation_messages;
drop policy if exists "insert reservation messages" on public.reservation_messages;
drop policy if exists "update read flags" on public.reservation_messages;

create policy "Admins can read reservation messages"
  on public.reservation_messages
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Admins can update reservation messages"
  on public.reservation_messages
  for update
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

create policy "Admins can delete reservation messages"
  on public.reservation_messages
  for delete
  to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role));

drop policy if exists "Public can subscribe to push" on public.push_subscriptions;

create policy "Public can subscribe as client"
  on public.push_subscriptions
  for insert
  to anon, authenticated
  with check (
    audience = 'client'
    and char_length(endpoint) between 5 and 2000
    and (fcm_token is null or (char_length(fcm_token) between 50 and 500))
    and (user_agent is null or char_length(user_agent) <= 1000)
  );

drop policy if exists "Admins can receive realtime" on realtime.messages;

create policy "Admins can receive realtime"
  on realtime.messages
  for select
  to anon, authenticated
  using (
    (auth.jwt() ->> 'role') = 'service_role'
    or (auth.uid() is not null and public.has_role(auth.uid(), 'admin'::public.app_role))
  );
