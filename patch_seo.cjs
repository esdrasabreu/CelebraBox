const fs = require('fs');
let code = fs.readFileSync('src/pages/PublicPage.tsx', 'utf8');

const seoLogic = `
  useEffect(() => {
    if (eventDetails.title) {
      document.title = \`\${eventDetails.title} | CelebraBox\`;
      
      const setMeta = (name, content, isProperty = false) => {
        const attr = isProperty ? 'property' : 'name';
        let el = document.querySelector(\`meta[\${attr}="\${name}"]\`);
        if (!el) {
          el = document.createElement('meta');
          el.setAttribute(attr, name);
          document.head.appendChild(el);
        }
        el.setAttribute('content', content);
      };
      
      const desc = eventDetails.story ? eventDetails.story.substring(0, 150) + '...' : 'Venha celebrar conosco!';
      
      setMeta('description', desc);
      setMeta('og:title', eventDetails.title, true);
      setMeta('og:description', desc, true);
      setMeta('og:image', eventDetails.coverImage, true);
      setMeta('twitter:card', 'summary_large_image');
      setMeta('twitter:title', eventDetails.title);
      setMeta('twitter:description', desc);
      setMeta('twitter:image', eventDetails.coverImage);
      
      // JSON-LD
      let script = document.querySelector('#jsonld-event');
      if (!script) {
        script = document.createElement('script');
        script.id = 'jsonld-event';
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }
      
      const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Event",
        "name": eventDetails.title,
        "description": desc,
        "startDate": eventDetails.date,
        "location": {
          "@type": "Place",
          "name": eventDetails.location.name,
          "address": {
            "@type": "PostalAddress",
            "streetAddress": eventDetails.location.address,
            "addressLocality": eventDetails.location.city,
            "addressRegion": eventDetails.location.state
          }
        },
        "image": eventDetails.coverImage,
        "url": window.location.href
      };
      script.textContent = JSON.stringify(jsonLd);
    }
  }, [eventDetails]);
`;

code = code.replace(/if \(isLoading\) \{/, seoLogic + "\n  if (isLoading) {");

fs.writeFileSync('src/pages/PublicPage.tsx', code);
