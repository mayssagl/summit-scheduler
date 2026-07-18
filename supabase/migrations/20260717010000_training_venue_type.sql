-- Training-level venue moves from free text to a structured type, so the
-- venue can be rendered consistently and (later) filtered/reported on.
-- venue_detail holds the hackerspace name (gomycode) or free description
-- (other); client_site needs no detail since it's derived from the client.
alter table public.trainings
  add column if not exists venue_type text not null default 'client_site'
    check (venue_type in ('client_site', 'gomycode', 'other')),
  add column if not exists venue_detail text;

-- preserve existing free-text venues rather than losing them
update public.trainings
set venue_type = 'other', venue_detail = venue
where venue is not null and trim(venue) <> '' and venue_detail is null;
