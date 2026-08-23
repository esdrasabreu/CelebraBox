const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminDashboard.tsx', 'utf8');

// Update settings form state
code = code.replace(/locationLat: eventDetails.location.latitude,\n\s*locationLng: eventDetails.location.longitude/g, 
  "slug: eventDetails.slug || '',\n    coverMediaType: eventDetails.coverMediaType || 'image',\n    coverVideoUrl: eventDetails.coverVideoUrl || ''");

// Update handleSaveSettings
const newSave = `
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setEventDetails({
        ...eventDetails,
        eventType: settingsForm.eventType,
        title: settingsForm.title,
        date: settingsForm.date,
        location: {
          name: settingsForm.locationName,
          address: settingsForm.locationAddress,
          city: settingsForm.locationCity,
          state: settingsForm.locationState,
          mapsLink: settingsForm.locationMapsLink
        },
        story: settingsForm.story,
        coverImage: settingsForm.coverImage,
        coverMediaType: settingsForm.coverMediaType,
        coverVideoUrl: settingsForm.coverVideoUrl,
        slug: settingsForm.slug || undefined,
      });
      toast.success('Configurações salvas com sucesso!');
    } catch(err) {
      toast.error('Erro: ' + err);
    }
  };
`;
code = code.replace(/const handleSaveSettings = async \(e: React\.FormEvent\) => \{[\s\S]*?\};/, newSave.trim());

// Update fields in JSX
// Find where locationLat is used and replace with slug and media
const fieldsToInject = `
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Slug (URL amigável)</label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 text-slate-500 sm:text-sm">
                        /e/
                      </span>
                      <input type="text" value={settingsForm.slug} onChange={e => setSettingsForm({...settingsForm, slug: e.target.value.replace(/[^a-z0-9-]/gi, '-').toLowerCase()})} className="flex-1 px-4 py-2 border border-slate-300 rounded-none rounded-r-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" placeholder="meu-casamento" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Capa</label>
                    <select value={settingsForm.coverMediaType} onChange={e => setSettingsForm({...settingsForm, coverMediaType: e.target.value as any})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none">
                      <option value="image">Imagem</option>
                      <option value="video">Vídeo</option>
                    </select>
                  </div>
                  {settingsForm.coverMediaType === 'video' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">URL do Vídeo (MP4)</label>
                      <input type="text" value={settingsForm.coverVideoUrl} onChange={e => setSettingsForm({...settingsForm, coverVideoUrl: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none" />
                    </div>
                  )}
`;
// Replace the two Optional Lat/Lng inputs with this
code = code.replace(/<div>\s*<label className="block text-sm font-medium text-slate-700 mb-1">Latitude \(Opcional\)<\/label>[\s\S]*?<\/div>\s*<div>\s*<label className="block text-sm font-medium text-slate-700 mb-1">Longitude \(Opcional\)<\/label>[\s\S]*?<\/div>/, fieldsToInject.trim());

fs.writeFileSync('src/pages/AdminDashboard.tsx', code);
