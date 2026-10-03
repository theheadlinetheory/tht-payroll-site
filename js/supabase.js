import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { PAYROLL_SUPABASE_URL, PAYROLL_SUPABASE_ANON_KEY } from './config.js?v=1a289eb';

// Read/write: this app's own payroll database.
export const sbPayroll = createClient(PAYROLL_SUPABASE_URL, PAYROLL_SUPABASE_ANON_KEY);

