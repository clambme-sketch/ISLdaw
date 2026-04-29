const fs = require('fs');
let text = fs.readFileSync('components/TrackEditor.tsx', 'utf8');

const regex = /updatePluginParam\(/g;
const matches = [...text.matchAll(regex)];

console.log(matches.length, "updatePluginParam left");
