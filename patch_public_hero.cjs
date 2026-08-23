const fs = require('fs');
let code = fs.readFileSync('src/pages/PublicPage.tsx', 'utf8');

const heroReplace = `
        <div className="absolute inset-0 z-0">
          {eventDetails.coverMediaType === 'video' && eventDetails.coverVideoUrl ? (
            <video 
              src={eventDetails.coverVideoUrl} 
              poster={eventDetails.coverImage}
              className="w-full h-full object-cover object-center"
              autoPlay muted loop playsInline
            />
          ) : (
            <img 
              src={eventDetails.coverImage} 
              alt="Hero cover" 
              className="w-full h-full object-cover object-center"
            />
          )}
          <div className="absolute inset-0 bg-black/40 mix-blend-multiply" />
        </div>
`;

code = code.replace(/<div className="absolute inset-0 z-0">[\s\S]*?<div className="absolute inset-0 bg-black\/40 mix-blend-multiply" \/>\s*<\/div>/, heroReplace.trim());

fs.writeFileSync('src/pages/PublicPage.tsx', code);
