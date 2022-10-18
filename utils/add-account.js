require('dotenv').config();
const Promise = require('bluebird');
const { generateSeedPhrase } = require('near-seed-phrase');
const { connect, keyStores, KeyPair, Account, utils } = require('near-api-js');
const { Command } = require('commander');
const program = new Command();

const vault = require('vault-node');

const homedir = require("os").homedir();
const CREDENTIALS_DIR = ".near-credentials";
const credentialsPath = require("path").join(homedir, CREDENTIALS_DIR);

const config = {
    networkId: "testnet",
    keyStore: new keyStores.UnencryptedFileSystemKeyStore(credentialsPath),
    nodeUrl: "https://rpc.testnet.near.org",
    walletUrl: "https://wallet.testnet.near.org",
    helperUrl: "https://helper.testnet.near.org",
    explorerUrl: "https://explorer.testnet.near.org",
};

program
    .name('add-account')
    .description('CLI to some add administrative titSTAKE™ Near accounts')
    .argument('<string>', 'Near AccountId to add including full path (i.e. newaccount.bra.testnet)')
    .requiredOption('-m, --masterAccount <master account>', 'must include the master account name')
    .action(addAccountAction)
    .version('0.0.0');

program.parse();


async function addAccountAction(accountId, options) {
    console.log({ accountId }, { options });
    const credentials = generateSeedPhrase();
    try {
        await Promise.delay(3000);
        //await vault.isAuthenticated();
        const response = await vault.setSecret(`private/near/${accountId}`, credentials);
	    console.log({ response });
    } catch (error) {
        console.error({ error });
        return;
    }

    const near = await connect(config);
    const masterAccount = await near.account(options.masterAccount);
    await config.keyStore.setKey(config.networkId, accountId, KeyPair.fromString(credentials.secretKey));
    await masterAccount.createAccount(
        accountId, // new account name
        credentials.publicKey, // public key for new account
        utils.format.parseNearAmount('10'), // initial balance for new account in yoctoNEAR
    );

}

