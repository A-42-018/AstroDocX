interface ImportMetaEnv {
  /** Optional: Supabase project URL for real ground sync (see docs/supabase.sql). */
  readonly VITE_SUPABASE_URL?: string
  /** Optional: Supabase anon key (public by design; access is limited by row-level security). */
  readonly VITE_SUPABASE_ANON_KEY?: string
}
