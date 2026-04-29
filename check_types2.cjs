const fs = require('fs');
let lines = fs.readFileSync('components/TrackEditor.tsx', 'utf8').split('\n');

for (let i=0; i<lines.length; i++) {
    let line = lines[i];
    if (line.includes('plugin.type === \'')) {
        let type = line.match(/plugin\.type === '([^']+)'/);
        console.log("---- Plugin:", type ? type[1] : line.trim(), "----");
    }
    if (line.includes('flex-shrink-0') && line.includes('</button>')) {
        let label = line.match(/>([^<]+)<\/button>/);
        if (label) {
            console.log(" Preset:", label[1]);
        }
    }
}
