const fs = require('fs');
let code = fs.readFileSync('src/lib/AppContext.tsx', 'utf8');

// Add resolvedHostId to state
code = code.replace(/const \[isLoading, setIsLoading\] = useState\(true\);/, "const [isLoading, setIsLoading] = useState(true);\n  const [resolvedHostId, setResolvedHostId] = useState<string>(hostId);");

code = code.replace(/if \(slugData\) \{\n              actualHostId = slugData.host_id;\n           \}/, "if (slugData) {\n              actualHostId = slugData.host_id;\n              setResolvedHostId(actualHostId);\n           }");

// Fix operations to use resolvedHostId instead of hostId
code = code.replace(/hostId !== 'default'/g, "resolvedHostId !== 'default'");
code = code.replace(/host_id: hostId/g, "host_id: resolvedHostId");
// Exception: in AppProvider params we still receive hostId

fs.writeFileSync('src/lib/AppContext.tsx', code);
