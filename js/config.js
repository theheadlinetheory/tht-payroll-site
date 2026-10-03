// Payroll app configuration. The browser talks only to the payroll database;
// CRM data reaches it through the ledger-sync edge function.
export const PAYROLL_SUPABASE_URL = 'https://uakqchqaplkrowaraufx.supabase.co';
export const PAYROLL_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVha3FjaHFhcGxrcm93YXJhdWZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNzY0NjgsImV4cCI6MjEwMDg1MjQ2OH0.ZfKCL44yH2pJyKkBS1XAOfxkoxjQeTruf6tNOH5AJgU';

// Who may sign in. This only decides what the sign-in screen accepts — the
// real gate is is_payroll_admin() in the database (migration 0002).
export const ALLOWED_EMAILS = ['aidan@theheadlinetheory.com', 'lars@theheadlinetheory.com'];
export const ALLOWED_DOMAIN = 'theheadlinetheory.com';
