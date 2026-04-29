const fs = require('fs');

let text = fs.readFileSync('components/TrackEditor.tsx', 'utf8');

text = text.replace(`                                                 for(let i=0; i<8; i++) {
                                                     updatePluginParam(plugin.id, \`band\${i}_gain\`, 0);
                                                     updatePluginParam(plugin.id, \`band\${i}_active\`, true);
                                                 }`, `                                                 const updates = {};
                                                 for(let i=0; i<8; i++) {
                                                     updates[\`band\${i}_gain\`] = 0;
                                                     updates[\`band\${i}_active\`] = true;
                                                 }
                                                 updatePluginParams(plugin.id, updates);`);

text = text.replace(`                                                 updatePluginParam(plugin.id, \`band0_type\`, 'highpass');
                                                 updatePluginParam(plugin.id, \`band0_freq\`, 100);
                                                 updatePluginParam(plugin.id, \`band0_q\`, 0.71);
                                                 updatePluginParam(plugin.id, \`band0_active\`, true);
                                                 for(let i=1; i<8; i++) updatePluginParam(plugin.id, \`band\${i}_gain\`, 0);`, `                                                 const updates = { band0_type: 'highpass', band0_freq: 100, band0_q: 0.71, band0_active: true };
                                                 for(let i=1; i<8; i++) updates[\`band\${i}_gain\`] = 0;
                                                 updatePluginParams(plugin.id, updates);`);

fs.writeFileSync('components/TrackEditor.tsx', text);
console.log("Done");
