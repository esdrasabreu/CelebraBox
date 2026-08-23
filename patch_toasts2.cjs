const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

code = code.replace(/alert\('Configurações de pagamento salvas com sucesso!'\);/g, "toast.success('Configurações de pagamento salvas com sucesso!');");

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
