const { createClient } = require('@supabase/supabase-js');

let supabaseClient;

function getSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        throw new Error(
            'Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
        );
    }

    if (!supabaseClient) {
        supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });
    }

    return supabaseClient;
}

module.exports = {
    getSupabase,
};
