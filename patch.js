const fs = require('fs');
let code = fs.readFileSync('src/components/CountdownTimer.tsx', 'utf8');
code = code.replace(
  'const target = new Date(targetDate);',
  'const target = new Date(targetDate);\n      if (isNaN(target.getTime())) return;'
);
code = code.replace(
  'return (',
  'if (!targetDate || isNaN(new Date(targetDate).getTime())) return null;\n\n  return ('
);
fs.writeFileSync('src/components/CountdownTimer.tsx', code);
