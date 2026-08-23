const fs = require('fs');
let code = fs.readFileSync('src/lib/AppContext.tsx', 'utf8');

const fetchLogic = `
  // Load from Supabase on mount if available
  useEffect(() => {
    const fetchData = async () => {
      if (!supabase || hostId === 'default') {
        setIsLoading(false);
        return;
      }
      
      try {
        let actualHostId = hostId;
        
        // Check if hostId is actually a slug
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(hostId);
        
        if (!isUuid) {
           const { data: slugData } = await supabase.from('event_details').select('host_id').eq('slug', hostId).single();
           if (slugData) {
              actualHostId = slugData.host_id;
           } else {
              setIsLoading(false);
              return;
           }
        }

        const [
          { data: eventData },
          { data: paymentData },
          { data: giftsData },
          { data: messagesData },
          { data: guestsData },
          { data: txData },
          { data: galleryData },
          { data: scheduleData },
          { data: expData }
        ] = await Promise.all([
          supabase.from('event_details').select('*').eq('host_id', actualHostId).single(),
          supabase.from('payment_settings').select('*').eq('host_id', actualHostId).single(),
          supabase.from('gifts').select('*').eq('host_id', actualHostId),
          supabase.from('messages').select('*').eq('host_id', actualHostId),
          supabase.from('guests').select('*').eq('host_id', actualHostId),
          supabase.from('transactions').select('*').eq('host_id', actualHostId),
          supabase.from('gallery').select('*').eq('host_id', actualHostId),
          supabase.from('schedule').select('*').eq('host_id', actualHostId),
          supabase.from('expenses').select('*').eq('host_id', actualHostId)
        ]);
`;

code = code.replace(/\/\/ Load from Supabase on mount if available[\s\S]*?\] = await Promise\.all\(\[/, fetchLogic);

// Replace hostId with actualHostId in the queries inside Promise.all
code = code.replace(/eq\('host_id', hostId\)/g, "eq('host_id', actualHostId)");

fs.writeFileSync('src/lib/AppContext.tsx', code);
