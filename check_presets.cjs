const fs = require('fs');

let text = fs.readFileSync('components/TrackEditor.tsx', 'utf8');

const regex = /updatePluginParams\([^}]+\}\}[^>]*>([^<]+)<\/button>/g;
let m;
while ((m = regex.exec(text)) !== null) {
    console.log("Preset:", m[1]);
}
