const fs = require('fs');
const path = './contracts/main/src/lib.rs';

fs.readFile(path, 'utf-8', function (err, data) {
    if (err) throw err;
 
    const contractId = fs.readFileSync(`./neardev-voting/dev-account`).toString();
    const re = new RegExp(`const\\sVOTING_CONTRACT:\\s&str\\s=\\s"(dev-[^"]*)";`, 'gim');

    data = data.replace(re, `const VOTING_CONTRACT: &str = "${contractId}";`);

    // patch config
    fs.writeFile(path, data, 'utf-8', function (err) {
        if (err) throw err;
        console.log(`Done! (${path})`);
    });
});
