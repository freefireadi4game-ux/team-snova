CREATE OR REPLACE FUNCTION public.merit_task_stats()
RETURNS TABLE (
  player_id uuid,
  assigned integer,
  completed integer,
  attempted_not_passed integer,
  pass_submissions integer,
  total_submissions integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH pl AS (
    SELECT id, role FROM public.players WHERE status = 'active'
  ),
  active_b AS (
    SELECT id, role FROM public.benchmarks WHERE status = 'active'
  ),
  assign AS (
    SELECT pl.id AS player_id, b.id AS benchmark_id
    FROM pl
    JOIN active_b b ON b.role = 'all' OR b.role = pl.role
  ),
  subs AS (
    SELECT s.player_id, s.benchmark_id, s.status FROM public.benchmark_submissions s
  )
  SELECT
    pl.id,
    (SELECT count(*) FROM assign a WHERE a.player_id = pl.id)::int,
    (SELECT count(DISTINCT a.benchmark_id) FROM assign a
       WHERE a.player_id = pl.id
         AND EXISTS (SELECT 1 FROM subs s WHERE s.player_id = pl.id AND s.benchmark_id = a.benchmark_id AND s.status = 'pass'))::int,
    (SELECT count(DISTINCT a.benchmark_id) FROM assign a
       WHERE a.player_id = pl.id
         AND EXISTS (SELECT 1 FROM subs s WHERE s.player_id = pl.id AND s.benchmark_id = a.benchmark_id)
         AND NOT EXISTS (SELECT 1 FROM subs s WHERE s.player_id = pl.id AND s.benchmark_id = a.benchmark_id AND s.status = 'pass'))::int,
    (SELECT count(*) FROM subs s WHERE s.player_id = pl.id AND s.status = 'pass')::int,
    (SELECT count(*) FROM subs s WHERE s.player_id = pl.id)::int
  FROM pl;
$$;

GRANT EXECUTE ON FUNCTION public.merit_task_stats() TO anon, authenticated, service_role;