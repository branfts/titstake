const fs = require('fs');
const state = JSON.parse(fs.readFileSync('./state.txt'));

/*
for (let kv of state) {
    console.log(kv.key);
}
*/

console.log(JSON.stringify({ keys: state.map(kv => kv.key) }));

const decoded = Object.values(state).map(kv => {
    kv.key = Buffer.from(kv.key, 'base64').toString();
    kv.value = Buffer.from(kv.value, 'base64').toString();
    return kv;
});

fs.writeFileSync('state-decoded.json', JSON.stringify(decoded, null, '  '));