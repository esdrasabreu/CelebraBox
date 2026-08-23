const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');
code = code.replace(
  'await setEventDetails({',
  'console.log("Saving settings...");\n    await setEventDetails({'
);
fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
