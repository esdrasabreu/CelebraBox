const fs = require('fs');
let code = fs.readFileSync('src/pages/PublicPage.tsx', 'utf8');

code = code.replace(/Por favor, digite seu nome completo abaixo para confirmar./g, "Por favor, digite seu nome completo ou código de confirmação abaixo para confirmar.");

fs.writeFileSync('src/pages/PublicPage.tsx', code);
