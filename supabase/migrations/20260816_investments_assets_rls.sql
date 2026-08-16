-- Harden user isolation for investments + assets (idempotent).
-- App queries select('*') without client-side user filters; RLS is the security boundary.

ALTER TABLE IF EXISTS investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assets ENABLE ROW LEVEL SECURITY;

-- investments historically keyed by user_id; also keep created_by in sync when present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'investments'
  ) THEN
    ALTER TABLE investments
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    ALTER TABLE investments
      ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;

    UPDATE investments
    SET created_by = user_id
    WHERE created_by IS NULL AND user_id IS NOT NULL;

    UPDATE investments
    SET user_id = created_by
    WHERE user_id IS NULL AND created_by IS NOT NULL;

    DROP POLICY IF EXISTS "Users can insert investments" ON investments;
    DROP POLICY IF EXISTS "Users can read own investments" ON investments;
    DROP POLICY IF EXISTS "Users can update own investments" ON investments;
    DROP POLICY IF EXISTS "Users can delete own investments" ON investments;

    CREATE POLICY "Users can insert investments" ON investments
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = COALESCE(user_id, created_by));

    CREATE POLICY "Users can read own investments" ON investments
      FOR SELECT TO authenticated
      USING (auth.uid() = COALESCE(user_id, created_by));

    CREATE POLICY "Users can update own investments" ON investments
      FOR UPDATE TO authenticated
      USING (auth.uid() = COALESCE(user_id, created_by))
      WITH CHECK (auth.uid() = COALESCE(user_id, created_by));

    CREATE POLICY "Users can delete own investments" ON investments
      FOR DELETE TO authenticated
      USING (auth.uid() = COALESCE(user_id, created_by));
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'assets'
  ) THEN
    ALTER TABLE assets
      ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE;

    DROP POLICY IF EXISTS "Users can insert assets" ON assets;
    DROP POLICY IF EXISTS "Users can read own assets" ON assets;
    DROP POLICY IF EXISTS "Users can update own assets" ON assets;
    DROP POLICY IF EXISTS "Users can delete own assets" ON assets;

    CREATE POLICY "Users can insert assets" ON assets
      FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = created_by);

    CREATE POLICY "Users can read own assets" ON assets
      FOR SELECT TO authenticated
      USING (auth.uid() = created_by);

    CREATE POLICY "Users can update own assets" ON assets
      FOR UPDATE TO authenticated
      USING (auth.uid() = created_by)
      WITH CHECK (auth.uid() = created_by);

    CREATE POLICY "Users can delete own assets" ON assets
      FOR DELETE TO authenticated
      USING (auth.uid() = created_by);
  END IF;
END $$;
