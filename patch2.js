const fs = require('fs');
let code = fs.readFileSync('src/lib/AppContext.tsx', 'utf8');
code = code.replace(
  'await supabase.from(\'event_details\').upsert({',
  'const { error } = await supabase.from(\'event_details\').upsert({\n'
);
code = code.replace(
  '      });\n    }\n  };',
  '      });\n      if (error) console.error("Upsert event_details error:", error);\n    }\n  };'
);
fs.writeFileSync('src/lib/AppContext.tsx', code);
