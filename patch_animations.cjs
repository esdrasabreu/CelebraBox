const fs = require('fs');
let code = fs.readFileSync('src/pages/PublicPage.tsx', 'utf8');

if(!code.includes('useReducedMotion')) {
    code = code.replace(/import \{ motion, AnimatePresence \} from 'motion\/react';/, "import { motion, AnimatePresence, useReducedMotion } from 'motion/react';");
    
    // Add useReducedMotion hook inside PublicPage
    code = code.replace(/const \[isMobileMenuOpen, setIsMobileMenuOpen\] = useState\(false\);/, "const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);\n  const shouldReduceMotion = useReducedMotion();");
    
    // Update variants to respect shouldReduceMotion
    const variantsLogic = `
  const fadeUpVariant = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } }
  };
`;
    code = code.replace(/const fadeUpVariant = \{[\s\S]*?\};/, variantsLogic.trim());
    fs.writeFileSync('src/pages/PublicPage.tsx', code);
}
