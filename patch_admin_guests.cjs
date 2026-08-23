const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

const replaceHTML = `
  <td className="px-6 py-4 font-medium text-slate-800">
    {guest.name}
    {guest.confirmationCode && (
      <div className="text-xs text-slate-400 mt-1">Código: {guest.confirmationCode}</div>
    )}
  </td>
`;
code = code.replace(/<td className="px-6 py-4 font-medium text-slate-800">\{guest\.name\}<\/td>/, replaceHTML.trim());

const buttons = `
  <button onClick={() => {
    const slugOrId = eventDetails.slug || hostId;
    const url = \`\${window.location.origin}/e/\${slugOrId}?code=\${guest.confirmationCode || ''}#rsvp\`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  }} className="p-1 text-slate-400 hover:text-teal-600 transition-colors mx-1" title="Copiar Link RSVP"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg></button>
  <button onClick={() => handleEditGuest(guest)} className="p-1 text-slate-400 hover:text-teal-600 transition-colors mx-1"><Edit className="w-4 h-4" /></button>
`;
code = code.replace(/<button onClick=\{\(\) => handleEditGuest\(guest\)\} className="p-1 text-slate-400 hover:text-teal-600 transition-colors mx-1"><Edit className="w-4 h-4" \/><\/button>/, buttons.trim());

// Also confirmation for deletions
code = code.replace(/onClick=\{\(\) => deleteGuest\(guest.id\)\}/g, "onClick={() => { if(confirm('Tem certeza que deseja excluir?')) deleteGuest(guest.id) }}");
code = code.replace(/onClick=\{\(\) => deleteGift\(gift.id\)\}/g, "onClick={() => { if(confirm('Tem certeza que deseja excluir?')) deleteGift(gift.id) }}");
code = code.replace(/onClick=\{\(\) => deleteScheduleItem\(item.id\)\}/g, "onClick={() => { if(confirm('Tem certeza que deseja excluir?')) deleteScheduleItem(item.id) }}");
code = code.replace(/onClick=\{\(\) => deleteExpense\(expense.id\)\}/g, "onClick={() => { if(confirm('Tem certeza que deseja excluir?')) deleteExpense(expense.id) }}");
code = code.replace(/onClick=\{\(\) => deleteGalleryImage\(img.id\)\}/g, "onClick={() => { if(confirm('Tem certeza que deseja excluir?')) deleteGalleryImage(img.id) }}");


fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
