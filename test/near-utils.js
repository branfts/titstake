module.exports = contractName => {
    const fs = require('fs');
    const nearAPI = require('near-api-js');
    const getConfig = require('./config');
    const { nodeUrl, networkId, contractMethods } = getConfig();
    const {
        keyStores: { InMemoryKeyStore },
        Near,
        Account,
        Contract,
        KeyPair,
        utils: {
            format: { parseNearAmount },
        },
    } = nearAPI;

    const credPath = `./neardev/${networkId}/${contractName}.json`;
    console.log('Loading Credentials:\n', credPath);

    let credentials = JSON.parse(fs.readFileSync(`${process.env.HOME}/.near-credentials/${networkId}/${contractName}.json`));
    
    const keyStore = new InMemoryKeyStore();
    keyStore.setKey(networkId, contractName, KeyPair.fromString(credentials.private_key));
    const near = new Near({
        networkId,
        nodeUrl,
        deps: { keyStore },
    });
    const { connection } = near;
    const contractAccount = new Account(connection, contractName);
    contractAccount.addAccessKey = (publicKey) => contractAccount.addKey(publicKey, contractName, contractMethods.changeMethods, parseNearAmount('0.1'));
    const contract = new Contract(contractAccount, contractName, contractMethods);

    return {
        near,
        keyStore,
        connection,
        contract,
        contractAccount,
        contractMethods,
    };
};
