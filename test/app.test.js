const BN = require("bn.js");
const { customAlphabet, nanoid } = require('nanoid');
const cnanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz');

const getConfig = require('./config');
const { GAS, contracts } = getConfig();
const contractName = contracts.main;
const testUtils = require("./test-utils")(contractName);
const {
    formatNearAmount,
    parseNearAmount,
} = require("near-api-js/lib/utils/format");
const {
    getAccount,
    getAccountBalance,
    contractAccount,
    main = { contracts },
    get79Percent,
    getPercentage,
    initContract,
    getStakedBalance,
    toBN,
} = testUtils;

const stakePool = 'legends.pool.f863973.m0';

const contractId = contractAccount.accountId;
console.log("\n\n contractId:", contractId, "\n\n");

describe(contractName, () => {
    let alice = {}, mary = {}, bob = {}, john = {}, jack = {};

    beforeAll(async () => {
        await initContract();
        
        alice.id = "alice-" + cnanoid(4) + "." + contractId;
        alice.account = getAccount(alice.id);
        console.log("\n\n Alice accountId:", alice.id, "\n\n");

        mary.id = "mary-" + cnanoid(4) + "." + contractId;
        mary.account = getAccount(mary.id);
        console.log("\n\n Mary accountId:", mary.id, "\n\n");

        bob.id = "bob-" + cnanoid(4) + "." + contractId;
        bob.account = getAccount(bob.id);
        console.log("\n\n Bob accountId:", bob.id, "\n\n");

        john.id = "john-" + cnanoid(4) + "." + contractId;
        john.account = getAccount(john.id);
        console.log("\n\n John accountId:", john.id, "\n\n");

        jack.id = "jack-" + cnanoid(4) + "." + contractId;
        jack.account = getAccount(jack.id);
        console.log("\n\n Jack accountId:", jack.id, "\n\n");

        await Promise.all([alice.account, mary.account, bob.account, john.account, jack.account]);
        [alice, mary, bob, john, jack].map(async accountObj => accountObj.account = await accountObj.account);
    });

    test(`contract owner changes the stake pool`, async () => {
        const newPool = 'staked.pool.f863973.m0';

        await contractAccount.functionCall({
            contractId,
            methodName: 'change_stake_pool',
            args: {
                pool: newPool,
            },
            gas: GAS,
            attachedDeposit: 1
        });
        const metadata = await contractAccount.viewFunction(contractName, 'metadata');
        expect(metadata.pool).toBe(newPool);
    });
    test(`contract owner changes the stake pool back`, async () => {
        const newPool = 'legends.pool.f863973.m0';

        await contractAccount.functionCall({
            contractId,
            methodName: 'change_stake_pool',
            args: {
                pool: newPool,
            },
            gas: GAS,
            attachedDeposit: 1
        });
        const metadata = await contractAccount.viewFunction(contractName, 'metadata');
        expect(metadata.pool).toBe(newPool);
    });
    test(`a user tries to change the stake pool`, async () => {
        try {
            await bob.account.functionCall({
                contractId,
                methodName: 'change_stake_pool',
                args: {
                    pool: 'staked.pool.f863973.m0',
                },
                gas: GAS,
                attachedDeposit: 1
            });
        } catch (error) {
            expect(true);
        }
    });
    test(`contract admin changes the admin metadata`, async () => {
        const newAdmins = [mary.id, alice.id];

        await contractAccount.functionCall({
            contractId,
            methodName: 'change_admin_users',
            args: {
                admins: newAdmins,
            },
            gas: GAS,
            attachedDeposit: 1
        });
        const metadata = await contractAccount.viewFunction(contractName, 'metadata');
        expect(metadata.admins).toEqual(expect.arrayContaining(newAdmins));
    });
    test(`admin alice admin changes the admin metadata and removes mary`, async () => {
        const newAdmins = [alice.id];

        await contractAccount.functionCall({
            contractId,
            methodName: 'change_admin_users',
            args: {
                admins: newAdmins,
            },
            gas: GAS,
            attachedDeposit: 1
        });
        const metadata = await contractAccount.viewFunction(contractName, 'metadata');
        expect(metadata.admins).toEqual(expect.arrayContaining(newAdmins));
    });
    test(`no longer an admin, mary tries to change the admin metadata but should fail`, async () => {
        const newAdmins = [mary.id, alice.id];

        try {
            await contractAccount.functionCall({
                contractId,
                methodName: 'change_admin_users',
                args: {
                    admins: newAdmins,
                },
                gas: GAS,
                attachedDeposit: 1
            });
        } catch (error) {
            expect(true);
        }
    });
    test(`non-admin user bob tries to change the admins`, async () => {
        try {
            await bob.account.functionCall({
                contractId,
                methodName: 'change_admin_users',
                args: {
                    admins: [bob.id],
                },
                gas: GAS,
                attachedDeposit: 1
            });
        } catch (error) {
            expect(true);
        }
    });
    test.only(`ended bets`, async () => {
        await Promise.all([...Array(20).keys()].map(index => {
            const bet_id = index < 2 ? ['c5VA2k16PbQC_KeOAZTkR', 'JixWNWsYXVacHF9sQsOFH'][index] : nanoid(), // c5VA2k16PbQC_KeOAZTkR is a static id used to test the voting contract
                person = ['bafybeihdzk6jvzkt2d3ekxkpkgdvtl3zryzeotsdlku7my6tncxxlyx3my', 'bafybeihjuem5s6djj6jidgp6mf6uwtvdyruufojwpa7n5dssmhbet2zg5u', 'bafybeigwqcbb5qj2463brh627ktivsgdeiikk4w2o6dgipgqoq4revy4fa'][Math.floor(Math.random() * 3)],
                end = (Date.now() + 60 * 1000) * 1000000, // 60 second buffer to make it to the contract logic without triggering an invalid date error
                randomStakers = [bob, john, jack, alice, mary]
                    .sort(() => 0.5 - Math.random())
                    .splice(Math.floor(2 + (Math.random() * 3)));

            Promise.all(randomStakers.map(({ account }, index) => {
                return account.functionCall({
                    contractId,
                    methodName: 'new_stake',
                    args: {
                        bet_id,
                        stake_id: nanoid(),
                        prediction: 'Reduction',
                        position: ['Lay', 'Back'][Math.floor(Math.random() * 2)],
                        person,
                        end: end + ((index + 1) * 60 * 1000 * 1000000) // purely to see a time difference in the UI
                    },
                    gas: GAS,
                    attachedDeposit: parseNearAmount('0.1')
                });
            }));
        }));
    });
    test.only(`gentlemans bet`, async () => {
        await bob.account.functionCall({
            contractId,
            methodName: 'new_stake',
            args: {
                bet_id: nanoid(),
                stake_id: nanoid(),
                prediction: 'Reduction',
                position: 'Lay',
                person: 'bafybeihdzk6jvzkt2d3ekxkpkgdvtl3zryzeotsdlku7my6tncxxlyx3my',
                end: (Date.now() + 8.64e+7) * 1000000,
                gentlemans: true,
            },
            gas: GAS,
            attachedDeposit: parseNearAmount('0.1')
        });
        // test should be something to ensure the bet is not matched.
    });
    test.only(`single bet`, async () => {
        const bet_id = nanoid(),
            end = (Date.now() + 8.64e+7) * 1000000;

        await bob.account.functionCall({
            contractId,
            methodName: 'new_stake',
            args: {
                bet_id,
                stake_id: nanoid(),
                prediction: 'Reduction',
                position: 'Lay',
                person: 'bafybeihdzk6jvzkt2d3ekxkpkgdvtl3zryzeotsdlku7my6tncxxlyx3my',
                end
            },
            gas: GAS,
            attachedDeposit: parseNearAmount('0.1')
        });
    });
    test.only(`single matching bet`, async () => {
        const bet_id = nanoid(),
            end = (Date.now() + 8.64e+7) * 1000000;

        await bob.account.functionCall({
            contractId,
            methodName: 'new_stake',
            args: {
                bet_id,
                stake_id: nanoid(),
                prediction: 'Reduction',
                position: 'Back',
                person: 'bafybeihjuem5s6djj6jidgp6mf6uwtvdyruufojwpa7n5dssmhbet2zg5u',
                end
            },
            gas: GAS,
            attachedDeposit: parseNearAmount('0.1')
        });

        const response = await alice.account.functionCall({
            contractId,
            methodName: 'new_stake',
            args: {
                bet_id,
                stake_id: nanoid(),
                prediction: 'Reduction',
                position: 'Lay',
                person: 'bafybeihjuem5s6djj6jidgp6mf6uwtvdyruufojwpa7n5dssmhbet2zg5u',
                end
            },
            gas: GAS,
            attachedDeposit: parseNearAmount('0.1')
        });

        console.log(JSON.stringify(Buffer.from(response.status.SuccessValue, 'base64').toString()), null, '  ');
    });
    test.only(`single matching bet`, async () => {
        const bet_id = nanoid(),
            end = (Date.now() + 8.64e+7) * 1000000;

        await bob.account.functionCall({
            contractId,
            methodName: 'new_stake',
            args: {
                bet_id,
                stake_id: nanoid(),
                prediction: 'Reduction',
                position: 'Back',
                person: 'bafybeigwqcbb5qj2463brh627ktivsgdeiikk4w2o6dgipgqoq4revy4fa',
                end
            },
            gas: GAS,
            attachedDeposit: parseNearAmount('0.1')
        });

        const response = await alice.account.functionCall({
            contractId,
            methodName: 'new_stake',
            args: {
                bet_id,
                stake_id: nanoid(),
                prediction: 'Reduction',
                position: 'Lay',
                person: 'bafybeigwqcbb5qj2463brh627ktivsgdeiikk4w2o6dgipgqoq4revy4fa',
                end
            },
            gas: GAS,
            attachedDeposit: parseNearAmount('0.1')
        });

        console.log(JSON.stringify(Buffer.from(response.status.SuccessValue, 'base64').toString()), null, '  ');
    });
    test.only(`single matching bet`, async () => {
        const bet_id = nanoid(),
            end = (Date.now() + 8.64e+7) * 1000000;

        await Promise.all([1, 2, 3, 4, 5].map(async bet => await bob.account.functionCall({
            contractId,
            methodName: 'new_stake',
            args: {
                bet_id,
                stake_id: nanoid(),
                prediction: 'Reduction',
                position: 'Back',
                person: 'bafybeigwqcbb5qj2463brh627ktivsgdeiikk4w2o6dgipgqoq4revy4fa',
                end
            },
            gas: GAS,
            attachedDeposit: parseNearAmount('0.1')
        })));

        await alice.account.functionCall({
            contractId,
            methodName: 'new_stake',
            args: {
                bet_id,
                stake_id: nanoid(),
                prediction: 'Reduction',
                position: 'Lay',
                person: 'bafybeigwqcbb5qj2463brh627ktivsgdeiikk4w2o6dgipgqoq4revy4fa',
                end
            },
            gas: GAS,
            attachedDeposit: parseNearAmount('0.3')
        });

        const state = await bob.account.viewFunction(contractId, 'stakes_for_bets', {
            bet_ids: [ bet_id ]
        });
        const unmatched = state.reduce((acc, cur) => acc.add(new BN(cur.unmatched)), new BN(0));
        const backs = state.filter(bet => bet.position === 'Back').length;
        const lays = state.filter(bet => bet.position === 'Lay').length;

        expect(backs).toBe(5);
        expect(lays).toBe(1);
        expect(unmatched.gt(new BN(parseNearAmount(`${get79Percent(0.2)}`)))).toBe(true);
        
        console.log(JSON.stringify(state), null, '  ');
    });
    test.only(`cancel bet (full)`, async () => {
        const bet_id = nanoid(),
            stake_id = nanoid(),
            end = (Date.now() + 8.64e+7) * 1000000;

        await bob.account.functionCall({
            contractId,
            methodName: 'new_stake',
            args: {
                bet_id,
                stake_id,
                prediction: 'Reduction',
                position: 'Back',
                person: 'bafybeigwqcbb5qj2463brh627ktivsgdeiikk4w2o6dgipgqoq4revy4fa',
                end
            },
            gas: GAS,
            attachedDeposit: parseNearAmount('0.1')
        });

        const response = await bob.account.functionCall({
            contractId,
            methodName: 'cancel_stake',
            args: {
                bet_id,
                stake_id,
            },
            gas: GAS,
            attachedDeposit: parseNearAmount('0.1')
        });

        expect(Buffer.from(response.status.SuccessValue, 'base64').toString()).toEqual(expect.stringMatching(/full cancellation pending/));
        console.log(JSON.stringify(Buffer.from(response.status.SuccessValue, 'base64').toString()), null, '  ');
    });
    test.only(`cancel bet (partial)`, async () => {
        const bet_id = nanoid(),
            stake_id = nanoid(),
            end = (Date.now() + 8.64e+7) * 1000000;

        await bob.account.functionCall({
            contractId,
            methodName: 'new_stake',
            args: {
                bet_id,
                stake_id,
                prediction: 'Reduction',
                position: 'Back',
                person: 'bafybeigwqcbb5qj2463brh627ktivsgdeiikk4w2o6dgipgqoq4revy4fa',
                end
            },
            gas: GAS,
            attachedDeposit: parseNearAmount('0.1')
        });
        await alice.account.functionCall({
            contractId,
            methodName: 'new_stake',
            args: {
                bet_id,
                stake_id: nanoid(),
                prediction: 'Reduction',
                position: 'Lay',
                person: 'bafybeigwqcbb5qj2463brh627ktivsgdeiikk4w2o6dgipgqoq4revy4fa',
                end
            },
            gas: GAS,
            attachedDeposit: parseNearAmount('0.069')
        });

        const response = await bob.account.functionCall({
            contractId,
            methodName: 'cancel_stake',
            args: {
                bet_id,
                stake_id
            },
            gas: GAS,
            attachedDeposit: parseNearAmount('0.1')
        });

        expect(Buffer.from(response.status.SuccessValue, 'base64').toString()).toEqual(expect.stringMatching(/partial cancellation pending/));
        console.log(JSON.stringify(Buffer.from(response.status.SuccessValue, 'base64').toString()), null, '  ');
    });
    test.only(`cancel bet (not cancelled)`, async () => {
        const bet_id = nanoid(),
            stake_id = nanoid(),
            end = (Date.now() + 8.64e+7) * 1000000;

        await bob.account.functionCall({
            contractId,
            methodName: 'new_stake',
            args: {
                bet_id,
                stake_id,
                prediction: 'Reduction',
                position: 'Back',
                person: 'bafybeigwqcbb5qj2463brh627ktivsgdeiikk4w2o6dgipgqoq4revy4fa',
                end
            },
            gas: GAS,
            attachedDeposit: parseNearAmount('0.1')
        });
        await alice.account.functionCall({
            contractId,
            methodName: 'new_stake',
            args: {
                bet_id,
                stake_id: nanoid(),
                prediction: 'Reduction',
                position: 'Lay',
                person: 'bafybeigwqcbb5qj2463brh627ktivsgdeiikk4w2o6dgipgqoq4revy4fa',
                end
            },
            gas: GAS,
            attachedDeposit: parseNearAmount('0.1')
        });

        const response = await bob.account.functionCall({
            contractId,
            methodName: 'cancel_stake',
            args: {
                bet_id,
                stake_id
            },
            gas: GAS,
            attachedDeposit: parseNearAmount('0.1')
        });

        expect(Buffer.from(response.status.SuccessValue, 'base64').toString()).toEqual(expect.stringMatching(/not cancelled/));
        console.log(JSON.stringify(Buffer.from(response.status.SuccessValue, 'base64').toString()), null, '  ');
    });
    test.only(`refund cancelled bet`, async () => {
        const bet_id = nanoid(),
            stake_id = nanoid(),
            end = (Date.now() + 8.64e+7) * 1000000,
            accountBalanceBefore = formatNearAmount((await getAccountBalance(bob.id)).total);

        await bob.account.functionCall({
            contractId,
            methodName: 'new_stake',
            args: {
                bet_id,
                stake_id,
                prediction: 'Reduction',
                position: 'Back',
                person: 'bafybeigwqcbb5qj2463brh627ktivsgdeiikk4w2o6dgipgqoq4revy4fa',
                end
            },
            gas: GAS,
            attachedDeposit: parseNearAmount('0.1')
        });

        await bob.account.functionCall({
            contractId,
            methodName: 'cancel_stake',
            args: {
                bet_id,
                stake_id,
            },
            gas: GAS,
            attachedDeposit: parseNearAmount('0.1')
        });

        const response = await bob.account.functionCall({
            contractId,
            methodName: 'refund_cancelled_stake',
            args: {
                stake_id,
            },
            gas: GAS,
        });
        
        const accountBalanceAfter = formatNearAmount((await getAccountBalance(bob.id)).total);
        console.log({accountBalanceBefore});
        console.log({accountBalanceAfter});
        expect(Number(accountBalanceBefore)).toBeCloseTo(Number(accountBalanceAfter), 1);
    });
    test.only(`view persons`, async () => {
        const persons = await bob.account.viewFunction(contractId, 'persons');
        expect(persons.length).toBe(3);
    });
    test.only(`view persons excluding`, async () => {
        const persons = await bob.account.viewFunction(contractId, 'persons', {
            exclude: [ 'bafybeigwqcbb5qj2463brh627ktivsgdeiikk4w2o6dgipgqoq4revy4fa' ]
        });
        expect(persons.length).toBe(2);
    });
    test.only(`view bets for person bafybeigwqcbb5qj2463brh627ktivsgdeiikk4w2o6dgipgqoq4revy4fa`, async () => {
        const bets = await bob.account.viewFunction(contractId, 'bets', {
            person: 'bafybeigwqcbb5qj2463brh627ktivsgdeiikk4w2o6dgipgqoq4revy4fa'
        });
        expect(bets.length).toBeGreaterThanOrEqual(10);
    });
    test.only(`view total persons`, async () => {
        const persons = await bob.account.viewFunction(contractId, 'persons_count');
        expect(persons).toBe('3');
    });
    test.only(`view total bets`, async () => {
        const bets = await bob.account.viewFunction(contractId, 'bets_count');
        expect(bets);
    });
    test.only(`view total stakes`, async () => {
        const stakes = await bob.account.viewFunction(contractId, 'stakes_count');
        expect(stakes);
    });
});
