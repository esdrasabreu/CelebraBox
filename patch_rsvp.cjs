const fs = require('fs');
let code = fs.readFileSync('src/pages/PublicPage.tsx', 'utf8');

const rsvpLogic = `
  const handleRsvpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const searchInput = rsvpName.trim();
    if (!searchInput) return;
    
    // First try by confirmation code (case insensitive)
    let guest = guests.find(g => g.confirmationCode?.toLowerCase() === searchInput.toLowerCase());
    
    // If not found by code, try by normalized name
    if (!guest) {
      const normalizeStr = (str) => str.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().trim();
      const searchName = normalizeStr(searchInput);
      
      // Exact match after normalization
      guest = guests.find(g => normalizeStr(g.name) === searchName);
      
      // If still not found, try partial match (suggestions logic could be complex, let's just do partial match for simplicity, or we show suggestions)
      if (!guest) {
         const possibleMatches = guests.filter(g => normalizeStr(g.name).includes(searchName) || searchName.includes(normalizeStr(g.name)));
         if (possibleMatches.length === 1) {
             guest = possibleMatches[0];
         } else if (possibleMatches.length > 1) {
             // Let's just say not found for now to prevent confirming wrong person if ambiguous
             setRsvpStatus('not_found');
         }
      }
    }

    if (guest) {
      await updateGuest(guest.id, { status: 'Confirmado' });
      setRsvpStatus('success');
    } else {
      setRsvpStatus('not_found');
    }

    setTimeout(() => {
      setRsvpStatus('idle');
      if (guest) setRsvpName('');
    }, 4000);
  };
`;

code = code.replace(/const handleRsvpSubmit = async \(e: React\.FormEvent\) => \{[\s\S]*?\}, 4000\);\n  \};/, rsvpLogic.trim());

// Update RSVP form labels
code = code.replace(/Nome Completo/g, "Nome ou Código de Confirmação");
code = code.replace(/Ex: João da Silva/g, "Ex: João da Silva ou ABC123");

fs.writeFileSync('src/pages/PublicPage.tsx', code);
