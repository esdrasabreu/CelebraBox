const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');
code = code.replace(
  "alert('Configurações salvas com sucesso!');",
  "try { await setEventDetails({ ...eventDetails, eventType: settingsForm.eventType, title: settingsForm.title, date: settingsForm.date, location: { name: settingsForm.locationName, address: settingsForm.locationAddress, city: settingsForm.locationCity, state: settingsForm.locationState, mapsLink: settingsForm.locationMapsLink, latitude: settingsForm.locationLat, longitude: settingsForm.locationLng }, story: settingsForm.story, coverImage: settingsForm.coverImage }); alert('Configurações salvas com sucesso!'); } catch(err) { alert('Erro: ' + err); }"
);
fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
