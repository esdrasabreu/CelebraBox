const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://xyz.supabase.co', 'xyz');

// We just want to mock the fetch to see if supabase-js throws
global.fetch = async (url, options) => {
  return {
    ok: false,
    status: 406,
    json: async () => ({ code: 'PGRST116', message: 'The result contains 0 rows' })
  };
};

async function run() {
  try {
    const res = await supabase.from('test').select('*').single();
    console.log("Resolved:", res);
  } catch (e) {
    console.error("Rejected:", e);
  }
}
run();
