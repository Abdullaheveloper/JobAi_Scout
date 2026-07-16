import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials in env. Url:", supabaseUrl, "Key:", supabaseKey ? "present" : "missing");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data: profiles, error } = await supabase.from('profiles').select('*');
  if (error) {
    console.error("Error fetching profiles:", error);
  } else {
    console.log("Profiles list (count = " + profiles.length + "):");
    profiles.forEach(p => {
      console.log({
        id: p.id,
        user_id: p.user_id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        location: p.location,
        skills: p.skills,
        experience_years: p.experience_years,
        created_at: p.created_at,
        data_sources: p.data_sources
      });
    });
  }
}

inspect();
