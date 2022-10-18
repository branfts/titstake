const { customAlphabet } = require('nanoid');
const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz');
const BN = require('bn.js');

const { Account, connect, keyStores, KeyPair, utils } = require('near-api-js');

(async () => {
    const accountId = nanoid() + '.shardnet';

    const keyStore = new keyStores.InMemoryKeyStore();
    const PRIVATE_KEY = "2mh2k2dYtp5Rj3WRwjhVfqxzoaTwKEo6UDYmow5cJypjHVdYoPWtTCXw3Yy4NDYFiyZK2PMqrfEMheVKdnMKkYhh";
    // creates a public / private key pair using the provided private key
    const keyPair = KeyPair.fromString(PRIVATE_KEY);
    // adds the keyPair you created to keyStore
    await keyStore.setKey("shardnet", accountId, keyPair);

    const near = await connect({
        networkId: 'shardnet',
        keyStore,
        nodeUrl: "https://rpc.shardnet.near.org",
        walletUrl: "https://wallet.shardnet.near.org",
        helperUrl: "https://helper.shardnet.near.org",
        explorerUrl: "https://explorer.shardnet.near.org",
    });

    console.log({near});

    account = new Account(near, accountId);

    account = await near.account(accountId);
    await account.createAccount(
        `user-${accountId}`,
        keyPair.publicKey,
        new BN(utils.format.parseNearAmount("2000"))
    );

    console.log({account});
})();