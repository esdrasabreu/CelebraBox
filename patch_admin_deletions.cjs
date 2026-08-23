const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

const replacement = (func, arg) => `onClick={() => { toast("Confirmar exclusão?", { action: { label: "Sim, Excluir", onClick: () => ${func}(${arg}) } }) }}`;

code = code.replace(/onClick=\{\(\) => \{ if\(confirm\('Tem certeza que deseja excluir\?'\)\) (deleteGuest\([^)]+\)) \}\}/g, "onClick={() => { toast('Confirmar exclusão?', { action: { label: 'Sim, Excluir', onClick: () => $1 } }) }}");
code = code.replace(/onClick=\{\(\) => \{ if\(confirm\('Tem certeza que deseja excluir\?'\)\) (deleteGift\([^)]+\)) \}\}/g, "onClick={() => { toast('Confirmar exclusão?', { action: { label: 'Sim, Excluir', onClick: () => $1 } }) }}");
code = code.replace(/onClick=\{\(\) => \{ if\(confirm\('Tem certeza que deseja excluir\?'\)\) (deleteScheduleItem\([^)]+\)) \}\}/g, "onClick={() => { toast('Confirmar exclusão?', { action: { label: 'Sim, Excluir', onClick: () => $1 } }) }}");
code = code.replace(/onClick=\{\(\) => \{ if\(confirm\('Tem certeza que deseja excluir\?'\)\) (deleteExpense\([^)]+\)) \}\}/g, "onClick={() => { toast('Confirmar exclusão?', { action: { label: 'Sim, Excluir', onClick: () => $1 } }) }}");
code = code.replace(/onClick=\{\(\) => \{ if\(confirm\('Tem certeza que deseja excluir\?'\)\) (deleteGalleryImage\([^)]+\)) \}\}/g, "onClick={() => { toast('Confirmar exclusão?', { action: { label: 'Sim, Excluir', onClick: () => $1 } }) }}");

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
