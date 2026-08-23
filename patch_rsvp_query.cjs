const fs = require('fs');
let code = fs.readFileSync('src/pages/PublicPage.tsx', 'utf8');

code = code.replace(/import \{ motion, AnimatePresence \} from 'motion\/react';/, "import { motion, AnimatePresence } from 'motion/react';\nimport { useSearchParams } from 'react-router-dom';");

// Find useState for rsvpName and replace it to read from search params
const replaceSearch = `
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || '';
  const [rsvpName, setRsvpName] = useState(initialCode);
`;
code = code.replace(/const \[rsvpName, setRsvpName\] = useState\(''\);/, replaceSearch.trim());

fs.writeFileSync('src/pages/PublicPage.tsx', code);
