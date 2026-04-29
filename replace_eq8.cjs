const fs = require('fs');
let code = fs.readFileSync('components/TrackEditor.tsx', 'utf8');

const regex = /({\/\* Special UI for Reverb \*\/}\n\s*{plugin\.type === 'EQ8' \? \()([\s\S]*?)(?:\s*\) : plugin\.type === 'DELAY' \? \()/;
const match = code.match(regex);
if (match) {
    console.log("Matched!");
    code = code.replace(regex, `$1
                                  <EQ8UI 
                                      plugin={plugin} 
                                      updatePluginParam={updatePluginParam} 
                                      updatePluginParams={updatePluginParams} 
                                  />
                              ) : plugin.type === 'DELAY' ? (`);
    fs.writeFileSync('components/TrackEditor.tsx', code);
} else {
    console.log("Not matched!");
}
