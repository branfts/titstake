const contracts = {
    main: 'dev-1667071456579-15208742404763',
    staking: 'dev-1662131033828-58340771735147'
};

module.exports = function getConfig() {
    let config = {
        networkId: "testnet",
        // nodeUrl: "https://rpc.testnet.near.org",
        nodeUrl: 'https://rpc-localdev.titstake.com',
        walletUrl: "https://wallet.testnet.near.org",
        helperUrl: "https://helper.testnet.near.org",
        contracts,
        GAS: "300000000000000",
        DEFAULT_NEW_ACCOUNT_AMOUNT: "10",
        DEFAULT_NEW_CONTRACT_AMOUNT: "200",
        contractMethods: {
            viewMethods: ['metadata', 'bets', 'stakes', 'stakes_for_bets'],
            changeMethods: ['new', 'new_stake', 'cancel_stake', 'refund_cancelled_stake'],
        },
    };
    return config;
};
