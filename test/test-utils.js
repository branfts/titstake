module.exports = contractName => {
    const fs = require('fs');
    const { join } = require('path');
    const BN = require('bn.js');
    const fetch = require('node-fetch');
    const nearAPI = require('near-api-js');
    const svgToMiniDataURI = require('mini-svg-data-uri');
    const { KeyPair, Account, Contract, utils: { format: { parseNearAmount } } } = nearAPI;
    const { near, connection, keyStore, contract, contractAccount } = require('./near-utils')(contractName);
    const getConfig = require('./config');
    const {
        networkId, contractMethods,
        DEFAULT_NEW_ACCOUNT_AMOUNT,
        DEFAULT_NEW_CONTRACT_AMOUNT,
    } = getConfig();

    const TEST_HOST = 'http://localhost:3000';
    const svg = fs.readFileSync(join(__dirname, '../icon.svg'), { encoding: 'utf-8' });

    /// exports
    async function initContract() {
    /// try to call new on contract, swallow e if already initialized
        try {
            const newArgs = {
                owner_id: contractAccount.accountId,
                metadata: {
                    spec: 'nft-2.0.0',
                    name: 'Test',
                    symbol: 'TEST',
                    base_uri: 'https://testnet.near.com'
                }
            };
            await contract.new({ args: newArgs });
        } catch (e) {
            if (!/initialized/.test(e.toString())) {
                throw e;
            }
        }
        return { contract, contractName };
    }
    const getAccountBalance = async (accountId) => (new nearAPI.Account(connection, accountId)).getAccountBalance();

    const initAccount = async (accountId, secret) => {
        account = new nearAPI.Account(connection, accountId);
        const newKeyPair = KeyPair.fromString(secret);
        keyStore.setKey(networkId, accountId, newKeyPair);
        return account;
    };
    const createOrInitAccount = async (accountId, secret) => {
        let account;
        try {
            account = await createAccount(accountId, DEFAULT_NEW_CONTRACT_AMOUNT, secret);
        } catch (e) {
            if (!/because it already exists/.test(e.toString())) {
                throw e;
            }
            account = new nearAPI.Account(connection, accountId);

            console.log(await getAccountBalance(accountId));

            const newKeyPair = KeyPair.fromString(secret);
            keyStore.setKey(networkId, accountId, newKeyPair);
        }
        return account;
    };

    async function getAccount(accountId, fundingAmount = DEFAULT_NEW_ACCOUNT_AMOUNT) {
        accountId = accountId || generateUniqueSubAccount();
        const account = new nearAPI.Account(connection, accountId);
        try {
            await account.state();
            return account;
        } catch (e) {
            if (!/does not exist/.test(e.toString())) {
                throw e;
            }
        }
        return await createAccount(accountId, fundingAmount);
    };


    async function getContract(account) {
        return new Contract(account || contractAccount, contractName, {
            ...contractMethods,
            signer: account || undefined
        });
    }


    const createAccessKeyAccount = (key) => {
        connection.signer.keyStore.setKey(networkId, contractName, key);
        return new Account(connection, contractName);
    };

    const postSignedJson = async ({ account, contractName, url, data = {} }) => {
        return await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                ...data,
                accountId: account.accountId,
                contractName,
                ...(await getSignature(account))
            })
        }).then((res) => {
        // console.log(res)
            return res.json();
        });
    };

    const postJson = async ({ url, data = {} }) => {
        return await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ ...data })
        }).then((res) => {
            console.log(res);
            return res.json();
        });
    };

    function generateUniqueSubAccount() {
        return `t${Date.now()}.${contractName}`;
    }

    /// internal
    async function createAccount(accountId, fundingAmount = DEFAULT_NEW_ACCOUNT_AMOUNT, secret) {
        const contractAccount = new Account(connection, contractName);
        const newKeyPair = secret ? KeyPair.fromString(secret) : KeyPair.fromRandom('ed25519');
        await contractAccount.createAccount(accountId, newKeyPair.publicKey, new BN(parseNearAmount(fundingAmount)));
        keyStore.setKey(networkId, accountId, newKeyPair);
        return new nearAPI.Account(connection, accountId);
    }

    async function createShardnetAccount(accountId, fundingAmount, secret) {
        const contractAccount = new Account({
            networkId: 'shardnet',
            ...connection
        }, contractName);
        const newKeyPair = secret ? KeyPair.fromString(secret) : KeyPair.fromRandom('ed25519');
        await contractAccount.createAccount(accountId, newKeyPair.publicKey, new BN(parseNearAmount(fundingAmount)));
        keyStore.setKey(networkId, accountId, newKeyPair);
        return new nearAPI.Account(connection, accountId);
    }

    const getSignature = async (account) => {
        const { accountId } = account;
        const block = await account.connection.provider.block({ finality: 'final' });
        const blockNumber = block.header.height.toString();
        const signer = account.inMemorySigner || account.connection.signer;
        const signed = await signer.signMessage(Buffer.from(blockNumber), accountId, networkId);
        const blockNumberSignature = Buffer.from(signed.signature).toString('base64');
        return { blockNumber, blockNumberSignature };
    };

    const loadCredentials = (accountId) => {
        const credPath = `./neardev/${networkId}/${accountId}.json`;
        console.log(
            "Loading Credentials:\n",
            credPath
        );

        let credentials;
        try {
            credentials = JSON.parse(
                fs.readFileSync(
                    credPath
                )
            );
        } catch (e) {
            console.warn('credentials not in /neardev');
            /// attempt to load backup creds from local machine
            credentials = JSON.parse(
                fs.readFileSync(
                    `${process.env.HOME}/.near-credentials/${networkId}/${accountId}.json`
                )
            );
        }

        return credentials;
    };

    const get79Percent = (amount) => {
        return `${amount * 0.79}`;
    };
    const getPercentage = (amount, percent) => {
        return `${amount * percent}`;
    };
    const toBN = javascriptNumber => new BN(`${Intl.NumberFormat('en-US').format(javascriptNumber).replaceAll(',','')}`);

    const getStakedBalance = async (accountId, stakePool) => {
        return (new nearAPI.Account(connection, accountId)).viewFunction(stakePool, 'get_account_staked_balance', {
            account_id: accountId
        });
    };

    return {
        TEST_HOST,
        near,
        connection,
        keyStore,
        getContract,
        getAccountBalance,
        contract,
        contractMethods,
        contractAccount,
        createOrInitAccount,
        createAccessKeyAccount,
        initContract, getAccount, postSignedJson, postJson,
        get79Percent,
        getPercentage,
        getStakedBalance,
        toBN,
    };

};

/// functionCallV2 console.warn upgrade helper

// [contractAccount, alice, bob].forEach((account) => {
// 	const temp = account.functionCall;
// 	const keys = ['contractId', 'methodName', 'args', 'gas', 'attachedDeposit'];
// 	account.functionCall = async (...args) => {
// 		if (typeof args[0] === 'string') {
// 			const functionCallOptions = {};
// 			args.forEach((arg, i) => {
// 				functionCallOptions[keys[i]] = arg;
// 			});
// 			console.warn(functionCallOptions);
// 		}
// 		return await temp.call(account, ...args);
// 	};
// });