const nearAPI = require('near-api-js');
const { connect, keyStores } = nearAPI;
const keyStore = new keyStores.UnencryptedFileSystemKeyStore(__dirname);
const config = {
    keyStore,
    networkId: 'testnet',
    nodeUrl: 'https://rpc.testnet.near.org',
    //nodeUrl: 'https://near-testnet.infura.io/v3/c1a2453180274a7a98455941e0cb2ec7',
    walletUrl: 'https://wallet.testnet.near.org',
    helperUrl: 'https://helper.testnet.near.org',
    explorerUrl: 'https://explorer.testnet.near.org',
};

async function main () {
    const near = await connect(config);
    const response = await near.connection.provider.query({
        request_type: 'view_state',
        finality: 'final',
        account_id: 'wishlist.contract.bra.testnet',
        prefix_base64: '',
    });
    //console.log(response.values);
    console.log(JSON.stringify({
    // TODO add calc size of data for limit burning 200TGas for one call on contract
	    keys: response.values.map((it, index) => index < 25 ? it.key : undefined).filter(key => key)
    }));
}

main().catch(reason => {
    console.error({reason});
});
