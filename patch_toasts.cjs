const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

// Replace standard alerts with toast
code = code.replace(/import React, { useState } from 'react';/, "import React, { useState } from 'react';\nimport { toast } from 'sonner';");

// Need to replace alert('...') with toast.success or toast.error
code = code.replace(/alert\('Configurações salvas com sucesso!'\)/g, "toast.success('Configurações salvas com sucesso!')");
code = code.replace(/alert\('Erro: ' \+ err\)/g, "toast.error('Erro: ' + err)");
code = code.replace(/alert\('Chave salva com sucesso!'\)/g, "toast.success('Chave salva com sucesso!')");

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
