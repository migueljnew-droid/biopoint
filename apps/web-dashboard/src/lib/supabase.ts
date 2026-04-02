import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://iygpnvihbhjkwbkkkwvq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5Z3BudmloYmhqa3dia2trd3ZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MjY3NzQsImV4cCI6MjA5MDQwMjc3NH0.pSG9_QJsqR9afv8efmHcqBhUkg_QgfPH0_QmICyDnvo";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
