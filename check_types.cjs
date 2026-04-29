const fs = require('fs');
let lines = fs.readFileSync('components/TrackEditor.tsx', 'utf8').split('\n');

for (let i=0; i<lines.length; i++) {
    if (lines[i].includes('plugin.type === \'')) {
        console.log("----");
        // extract plugin type
        const type = Object.values(lines[i].match(/plugin\.type === '([^']+)'/) || [])[1];
        console.log("Plugin:", type || lines[i].trim());
    }
    if (lines[i].includes('</button>') && lines[i].includes('flex-shrink-0')) {
        console.log(lines[i].trim());
    }
}
