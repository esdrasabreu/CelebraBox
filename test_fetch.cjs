const fs = require('fs');
const ts = require('typescript');
const code = fs.readFileSync('src/lib/AppContext.tsx', 'utf8');
const result = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS }});
// console.log("Compiled OK");
