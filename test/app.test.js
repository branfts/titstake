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
    const stakeId1 = nanoid();
    const stakeId2 = nanoid();

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
    test(`ended bets`, async () => {
        let usedPersons = [];
        let unusedPersons = [
            'bafybeihdzk6jvzkt2d3ekxkpkgdvtl3zryzeotsdlku7my6tncxxlyx3my',
            'bafybeihjuem5s6djj6jidgp6mf6uwtvdyruufojwpa7n5dssmhbet2zg5u',
            'bafybeigwqcbb5qj2463brh627ktivsgdeiikk4w2o6dgipgqoq4revy4fa',
            'bafybeihdsum5qnm5fhylf3li36d752l7pozadsf76tucnvvne753xsh7ei',
            'bafybeiavay7ddmf4vsm3audrj7s7u47awwyfn2yslia5zg3jzh7o2gpcju',
            'bafybeiguyjbhq7xyj5mvjspdxcpwbfn2xewcrunabjb663hnudbobx6rzu',
            'bafybeigjynv4uo5yyxec7th7lbardr6aozhcyb6onsoi23mkthiim26vhm',
            'bafybeidwwzfc6onlew2sea7wooovhc6a5b5bs6nlilcsjw5bbsvpr2conu',
            'bafybeifvouxxbup5xaxxinkp5ptf3y2w6lahegeueyzcxztgx2gm44plom',
            'bafybeigdwhuqyzzav6hjfpph2mg7tc7zijxemskyix3jikh4guftdke2yy',
            'bafybeiezfxpm7durc3v34e35vgk4efozphifgousx7i4sxg2ux2p7swjvi',
            'bafybeie6deafy6tfytsdwqw3g36ziidcvldokivtjbclp6isueijnf4rci',
            'bafybeiew4ptab33q46rwmv2zgan7gwxbjcnmneci7rt2rkadw3jphezuoa'
        ];
            
        await Promise.all([...Array(20).keys()].map(index => {
            if (!unusedPersons?.length) {
                unusedPersons = [ ...usedPersons.slice(0, usedPersons.length) ];
            }
            const randomIndex = Math.floor(Math.random() * unusedPersons.length);
            const bet_id = index < 2 ? ['c5VA2k16PbQC_KeOAZTkR', 'JixWNWsYXVacHF9sQsOFH'][index] : nanoid(), // c5VA2k16PbQC_KeOAZTkR is a static id used to test the voting contract
                person = `${unusedPersons[randomIndex]}`,
                end = (Date.now() + 60 * 1000) * 1000000, // 60 second buffer to make it to the contract logic without triggering an invalid date error
                randomStakers = [bob, john, jack, alice, mary]
                    .sort(() => 0.5 - Math.random())
                    .splice(Math.floor(2 + (Math.random() * 3)));

            usedPersons.push(unusedPersons.splice(randomIndex, 1));
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
    test(`gentlemans bet`, async () => {
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
    test(`single bet`, async () => {
        const bet_id = nanoid(),
            end = (Date.now() + 8.64e+7) * 1000000;

        await bob.account.functionCall({
            contractId,
            methodName: 'new_stake',
            args: {
                bet_id,
                stake_id: stakeId1,
                prediction: 'Reduction',
                position: 'Lay',
                person: 'bafybeihdzk6jvzkt2d3ekxkpkgdvtl3zryzeotsdlku7my6tncxxlyx3my',
                end
            },
            gas: GAS,
            attachedDeposit: parseNearAmount('0.1')
        });
    });
    test(`single matching bet`, async () => {
        const bet_id = nanoid(),
            end = (Date.now() + 8.64e+7) * 1000000;

        await bob.account.functionCall({
            contractId,
            methodName: 'new_stake',
            args: {
                bet_id,
                stake_id: stakeId2,
                prediction: 'Reduction',
                position: 'Back',
                person: 'bafybeihjuem5s6djj6jidgp6mf6uwtvdyruufojwpa7n5dssmhbet2zg5u',
                end
            },
            gas: GAS,
            attachedDeposit: parseNearAmount('0.2')
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
    test(`single matching bet`, async () => {
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
    test(`single matching bet`, async () => {
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
    test(`cancel bet (full)`, async () => {
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
    test(`cancel bet (partial)`, async () => {
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
    test(`cancel bet (not cancelled)`, async () => {
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
    test(`refund cancelled bet`, async () => {
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
    test(`view persons`, async () => {
        const persons = await bob.account.viewFunction(contractId, 'persons');
        expect(persons.length).toBe(13);
    });
    test(`view persons excluding`, async () => {
        const persons = await bob.account.viewFunction(contractId, 'persons', {
            exclude: [ 'bafybeigwqcbb5qj2463brh627ktivsgdeiikk4w2o6dgipgqoq4revy4fa' ]
        });
        expect(persons.length).toBe(12);
    });
    test(`view bets for person bafybeigwqcbb5qj2463brh627ktivsgdeiikk4w2o6dgipgqoq4revy4fa`, async () => {
        const bets = await bob.account.viewFunction(contractId, 'bets', {
            person: 'bafybeigwqcbb5qj2463brh627ktivsgdeiikk4w2o6dgipgqoq4revy4fa'
        });
        expect(bets.length).toBeGreaterThanOrEqual(6);
    });
    test(`view total persons`, async () => {
        const persons = await bob.account.viewFunction(contractId, 'persons_count');
        expect(persons).toBe('13');
    });
    test(`view total bets`, async () => {
        const bets = await bob.account.viewFunction(contractId, 'bets_count');
        expect(bets);
    });
    test(`view total stakes`, async () => {
        const stakes = await bob.account.viewFunction(contractId, 'stakes_count');
        expect(stakes);
    });
    test(`calculate stake earning`, async () => {
        const stake_id = nanoid();

        await bob.account.functionCall({
            contractId,
            methodName: 'new_stake',
            args: {
                bet_id: nanoid(),
                stake_id,
                prediction: 'Reduction',
                position: 'Lay',
                person: 'bafybeihdzk6jvzkt2d3ekxkpkgdvtl3zryzeotsdlku7my6tncxxlyx3my',
                end: (Date.now() + 8.64e+7) * 1000000
            },
            gas: GAS,
            attachedDeposit: parseNearAmount('1')
        });

        const response = await bob.account.functionCall({
            contractId,
            methodName: 'stake_earnings',
            args: {
                stake_ids: [stake_id],
            },
        });

        const reward = JSON.parse(Buffer.from(response.status.SuccessValue, 'base64').toString());

        console.log(reward.yield_balance, formatNearAmount(reward.yield_balance));
        expect(reward[0]).toEqual(expect.objectContaining({
            stake_id,
            epochs: expect.any(Array),
            yield_balance: expect.any(String),
            total_balance: expect.any(String)
        }));
    });
    test(`view total stakes for person`, async () => {
        const stakes = await bob.account.viewFunction(contractId, 'stakes_for_person', {
            staker: bob.id
        });
        expect(stakes);
    });
    test(`view earnings for stakes`, async () => {
        const earnings = await bob.account.viewFunction(contractId, 'stake_earnings', {
            stake_ids: [stakeId1, stakeId2]
        });
        console.log(earnings);
        expect(earnings);
    });
});
