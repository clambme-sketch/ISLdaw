const fs = require('fs');

let text = fs.readFileSync('components/TrackEditor.tsx', 'utf8');

text = text.replace(/onClick=\{\(\) => \{([\s\S]*?)\}\}/g, (match, content) => {
    // If it has a for loop, handle it manually or skip
    if (content.includes('for(') || content.includes('for (')) {
        return match;
    }

    const calls = [];
    const regex = /updatePluginParam\(\s*plugin\.id\s*,\s*[`']([^`']+)[`']\s*,\s*(.*?)\s*\);/g;
    let m;
    while ((m = regex.exec(content)) !== null) {
        calls.push({ key: m[1], val: m[2] });
    }

    if (calls.length <= 1) {
        return match;
    }

    // Replace everything that matched the regex with empty string
    let newContent = content.replace(/updatePluginParam\(\s*plugin\.id\s*,\s*[`']([^`']+)[`']\s*,\s*(.*?)\s*\);[^\S\n]*\n?/g, '');
    
    let dictContent = "{\n";
    calls.forEach(c => {
        dictContent += `                                                   '${c.key}': ${c.val},\n`;
    });
    dictContent += "                                               }";

    const out = `onClick={() => {${newContent.replace(/\s+$/, '')}\n                                               updatePluginParams(plugin.id, ${dictContent});\n                                             }}`;
    return out;
});

fs.writeFileSync('components/TrackEditor.tsx', text);
console.log("Done");
