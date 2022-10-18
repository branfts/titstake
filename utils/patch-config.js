const fs = require('fs');
const contracts = ['main', 'voting'].map(id => {
    try {
        return { id, name: fs.readFileSync(`./neardev-${id}/dev-account`).toString() };
    } catch (error) {
        console.log(error);
    }
}).filter(contract => contract);

const paths = [
    './test/config.js',
    '/vol/synology/development/titstake.near.contract-id.txt',
    '/vol/synology/development/titstake-voting.near.contract-id.txt',
    '~/titstake/strap/.env',
    '~/titstake/strap/reload-nodemon.json',
];

fs.readFile(paths[0], 'utf-8', function (err, data) {
    if (err) {
        throw err;
        
    }
 
    for (const contract of contracts) {
        const { id, name } = contract;
        const re = new RegExp(`${id}:\\s'([^']*)'`, 'gim');

        data = data.replace(re, `${id}: '${name}'`);

        // patch config
        fs.writeFile(paths[0], data, 'utf-8', function (err) {
            if (err) throw err;
            console.log(`Done! (${paths[0]})`);
        });

        // patch remote config
        const remotePath = id === 'main' ? paths[1] : paths[2];
        fs.writeFile(remotePath, name, 'utf-8', function (err) {
            if (err) throw err;
            console.log(`Done! (${remotePath})`);
        });
    }
});

// patch backend dev server config
fs.readFile(paths[3], 'utf-8', function (err, data) {
    if (err) throw err;

    const stakingContract = contracts.find(contract => contract.id === 'main');
    const re = new RegExp(`NEAR_STAKING_CONTRACT_ID=(.*)`);

    data = data.replace(re, `NEAR_STAKING_CONTRACT_ID=${stakingContract.name}`);

    fs.writeFile(paths[3], data, 'utf-8', function (err) {
        if (err) throw err;
        console.log(`Done! (${paths[3]})`);
    });

    // needed because nodemon won't reload on .env update... see https://github.com/remy/nodemon/issues/1806
    fs.writeFile(paths[4], JSON.stringify({
        date: new Date(),
        contractId: stakingContract.name

    }), 'utf-8', function (err) {
        if (err) throw err;
        console.log(`Done! (${paths[4]})`);
    });
});
