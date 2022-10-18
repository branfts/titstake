const crypto = require('crypto');
const BN = require('bn.js');

const getConfig = require('./config');
const { GAS, contracts } = getConfig();

const contractName = contracts.voting;
const testUtils = require("./test-utils")(contractName);
const {
    formatNearAmount,
    parseNearAmount,
} = require("near-api-js/lib/utils/format");
const {
    getAccount,
    getAccountBalance,
    contractAccount,
    getPercentage,
    initContract,
} = testUtils;

const contractId = contractAccount.accountId;
console.log('\n\n contractId:', contractId, '\n\n');

let alice, aliceId, jill, jillId, bob, bobId, alicesMotion, bobsOpenMotion, unnamedUserIds, unnamedUserAccounts;

beforeAll(async () => {
    const now = Date.now();

    await initContract();

    aliceId = 'alice-' + now + '.' + contractId;
    bobId = 'bob-' + now + '.' + contractId;
    jillId = 'jill-' + now + '.' + contractId;
    unnamedUserIds = [1, 2, 3, 4, 5].map((userIndex) => `user-${userIndex}-${now}.${contractId}`);

    try {
        alice = getAccount(aliceId);
        bob = getAccount(bobId);
        jill = getAccount(jillId);
        let allUserAccounts = [alice, bob, jill].concat(unnamedUserIds.map((user) => getAccount(user)));
        allUserAccounts = await Promise.all(allUserAccounts);
        //await Promise.all([alice, bob, jill].map(async (user) => await getAccount(user)));
        //await Promise.all(unnamedUserIds.map((user) => getAccount(user)));

        unnamedUserAccounts = allUserAccounts
            .map((account) => {
                if (!account.accountId.match(/^(alice|jill|bob)-/)) return account;
                switch (account.accountId.match(/^(alice|jill|bob)-/)[1]) {
                case 'alice':
                    alice = account;
                    break;
                case 'jill':
                    jill = account;
                    break;
                case 'bob':
                    bob = account;
                    break;
                }
                return account;
            })
            .filter((account) => account.accountId.match(/^user-/));
    } catch (error) {
        console.log(error);
    }
}, 120000);

function getUserData(name) {
    if (`${name}`.match(/[1-9]/)) {
        const index = name - 1;
        return {
            userId: unnamedUserIds[index],
            userAccount: unnamedUserAccounts[index],
        };
    }
    switch (name) {
    case 'alice':
        return {
            userId: aliceId,
            userAccount: alice,
        };
        break;
    case 'bob':
        return {
            userId: bobId,
            userAccount: bob,
        };
        break;
    case 'jill':
        return {
            userId: jillId,
            userAccount: jill,
        };
        break;
    }
}
describe('deploy contract ' + contractId, () => {
    test(`Alice tries to vote on a motion before registering`, async () => {
        try {
            await alice.functionCall({
                contractId: contractId,
                methodName: 'vote',
                args: {
                    motion_id: 1,
                    value: true,
                },
                gas: GAS,
                attachedDeposit: 1,
            });
        } catch (error) {
            expect(error).toBeTruthy();
        }
    });
    test(`Alice tries to create and vote on a motion before registering.`, async () => {
        try {
            await alice.functionCall({
                contractId: contractId,
                methodName: 'motion',
                args: {
                    description: `Remove Bob (${bobId}) from his role in the group.`,
                    value: true,
                },
                gas: GAS,
                attachedDeposit: 1,
            });
        } catch (error) {
            expect(error).toBeTruthy();
        }
    });
    describe.each(['alice', 'bob', 'jill'])(`Each user registers with the contract as a voter. 1 NEAR is required.`, (name) => {
        name !== 'alice'
            ? test.skip(`${name} registers without attaching a deposit of 1 NEAR.`, () => {})
            : test(`${name} registers without attaching a deposit of 1 NEAR.`, async () => {
                const { userAccount } = getUserData(name);
                try {
                    await userAccount.functionCall({
                        contractId: contractId,
                        methodName: 'register',
                        gas: GAS,
                    });
                } catch (error) {
                    expect(error).toBeTruthy();
                }
			  });
        name === 'alice'
            ? test.skip(`${name} registers attaching a deposit greater than 1 NEAR.`, () => {})
            : test(`${name} registers attaching a deposit greater than 1 NEAR.`, async () => {
                const { userAccount, userId } = getUserData(name);
                const contractAccountBalanceBefore = await getAccountBalance(contractId);
                const userBalanceBefore = await getAccountBalance(userId);
                //console.log({ userBalanceBefore: formatNearAmount(userBalanceBefore.total) })
                await userAccount.functionCall({
                    contractId: contractId,
                    methodName: 'register',
                    gas: GAS,
                    attachedDeposit: parseNearAmount('2'),
                });
                const registeredUsers = await userAccount.viewFunction(contractId, 'registered');
                const userBalanceAfter = await getAccountBalance(userId);
                const contractAccountBalanceAfter = await getAccountBalance(contractId);
                /**
                    console.log(
						{ userBalanceAfter: formatNearAmount(userBalanceAfter.total) },
						{ contractAccountBalanceAfter: formatNearAmount(contractAccountBalanceAfter.total) }
					)
                    */
                expect(
                    new BN(contractAccountBalanceAfter.total).sub(new BN(contractAccountBalanceBefore.total)).gt(new BN(parseNearAmount(getPercentage(1, 0.79))))
                ).toEqual(true);
                expect(new BN(userBalanceBefore.total).sub(new BN(userBalanceAfter.total)).gt(new BN(parseNearAmount(getPercentage(1, 0.79))))).toEqual(true);
                expect(registeredUsers).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            account_id: userId,
                            vote: null,
                        }),
                    ])
                );
			  });
        name !== 'alice'
            ? test.skip(`${name} registers and deposits 1 NEAR.`, () => {})
            : test(`${name} registers and deposits 1 NEAR.`, async () => {
                const { userAccount, userId } = getUserData(name);
                const contractAccountBalanceBefore = await getAccountBalance(contractId);
                const userBalanceBefore = await getAccountBalance(userId);
                //console.log({ userBalanceBefore: formatNearAmount(userBalanceBefore.total) })
                await userAccount.functionCall({
                    contractId: contractId,
                    methodName: 'register',
                    gas: GAS,
                    attachedDeposit: parseNearAmount('1'),
                });
                const registeredUsers = await userAccount.viewFunction(contractId, 'registered');
                const userBalanceAfter = await getAccountBalance(userId);
                const contractAccountBalanceAfter = await getAccountBalance(contractId);
                /**console.log(
						{ userBalanceAfter: formatNearAmount(userBalanceAfter.total) },
						{ contractAccountBalanceAfter: formatNearAmount(contractAccountBalanceAfter.total) }
					)*/
                expect(
                    new BN(contractAccountBalanceAfter.total).sub(new BN(contractAccountBalanceBefore.total)).gt(new BN(parseNearAmount(getPercentage(1, 0.79))))
                ).toEqual(true);
                expect(new BN(userBalanceBefore.total).sub(new BN(userBalanceAfter.total)).gt(new BN(parseNearAmount(getPercentage(1, 0.79))))).toEqual(true);
                expect(registeredUsers).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({
                            account_id: userId,
                            vote: null,
                        }),
                    ])
                );
			  });
    });
    test(`Alice tries to register twice.`, async () => {
        const contractAccountBalanceBefore = await getAccountBalance(contractId);
        const aliceAccountBalanceBefore = await getAccountBalance(aliceId);
        try {
            await alice.functionCall({
                contractId: contractId,
                methodName: 'register',
                gas: GAS,
                attachedDeposit: parseNearAmount('1'),
            });
        } catch (error) {
            expect(error).toBeTruthy();
        }
        const aliceAccountBalanceAfter = await getAccountBalance(aliceId);
        const contractAccountBalanceAfter = await getAccountBalance(contractId);
        console.log('contractAccountBalance 99%: ', getPercentage(contractAccountBalanceBefore.total, 0.99));
        console.log('aliceAccountBalance 99%: ', getPercentage(aliceAccountBalanceBefore.total, 0.99));
        expect(new BN(aliceAccountBalanceBefore.total).sub(new BN(aliceAccountBalanceAfter.total)).gt(parseNearAmount(getPercentage(aliceAccountBalanceBefore.total, 0.99)))).toEqual(true);
        expect(new BN(contractAccountBalanceBefore.total).sub(new BN(contractAccountBalanceAfter.total)).gt(parseNearAmount(getPercentage(contractAccountBalanceBefore.total, 0.99)))).toEqual(true);
    });
    test(`Total registered users should be 3`, async () => {
        const registeredUsers = await contractAccount.viewFunction(contractId, 'registered');
        expect(registeredUsers.length).toBe(3);
    });
    test(`Alice tries to vote on a non-existent motion.`, async () => {
        try {
            await alice.functionCall({
                contractId: contractId,
                methodName: 'vote',
                args: {
                    motion_id: '1',
                    value: true,
                },
                gas: GAS,
                attachedDeposit: 1,
            });
        } catch (error) {
            expect(error).toBeTruthy();
        }
    });
    test(`Alice creates a motion and votes on her motion.`, async () => {
        const receipt = await alice.functionCall({
            contractId: contractId,
            methodName: 'motion',
            args: {
                description: `Remove Bob (${bobId}) from his role in the group.`,
                value: true,
            },
            gas: GAS,
            attachedDeposit: 1,
        });
        alicesMotion = JSON.parse(Buffer.from(receipt.status.SuccessValue, 'base64').toString());
        expect(alicesMotion.motion_id).toBeTruthy();
        expect(alicesMotion.status).toBe('OPEN');
    });
    test(`Alice views the motion she just created.`, async () => {
        const response = await alice.viewFunction(contractId, 'view_motions', {
            motion_ids: [alicesMotion.motion_id],
        });
        const { motion, voters } = response[0];
        expect(motion).toEqual(
            expect.objectContaining({
                motion_id: alicesMotion.motion_id,
                description: `Remove Bob (${bobId}) from his role in the group.`,
                status: 'OPEN',
            })
        );
        expect(voters).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    account_id: aliceId,
                    vote: {
                        value: true,
                        voter_id_hash: Array.from(crypto.createHash('sha256').update(aliceId).digest()),
                    },
                }),
            ])
        );
    });
    test(`Alice accidentally votes on her motion a 2nd time.`, async () => {
        try {
            await alice.functionCall({
                contractId: contractId,
                methodName: 'vote',
                args: {
                    motion_id: alicesMotion.motion_id,
                    value: true,
                },
                gas: GAS,
                attachedDeposit: 1,
            });
        } catch (error) {
            expect(error).toBeTruthy();
        }
    });
    test(`Jill votes on Alice's motion.`, async () => {
        await jill.functionCall({
            contractId: contractId,
            methodName: 'vote',
            args: {
                motion_id: alicesMotion.motion_id,
                value: true,
            },
            gas: GAS,
            attachedDeposit: 1,
        });
        const response = await jill.viewFunction(contractId, 'view_motions', {
            motion_ids: [alicesMotion.motion_id],
        });
        const { motion, voters } = response[0];

        expect(motion).toEqual(
            expect.objectContaining({
                motion_id: alicesMotion.motion_id,
                description: `Remove Bob (${bobId}) from his role in the group.`,
                status: 'ADOPTED',
            })
        );
        expect(voters).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    account_id: aliceId,
                    vote: {
                        value: true,
                        voter_id_hash: Array.from(crypto.createHash('sha256').update(aliceId).digest()),
                    },
                }),
                expect.objectContaining({
                    account_id: jillId,
                    vote: {
                        value: true,
                        voter_id_hash: Array.from(crypto.createHash('sha256').update(jillId).digest()),
                    },
                }),
            ])
        );
    });
    test(`Bob votes on Alice's motion but the voting window is already adopted.`, async () => {
        try {
            await bob.functionCall({
                contractId: contractId,
                methodName: 'vote',
                args: {
                    motion_id: alicesMotion.motion_id,
                    value: false,
                },
                gas: GAS,
                attachedDeposit: 1,
            });
        } catch (error) {
            expect(error).toBeTruthy();
        }
    });
    test(`So Bob opens his own motion to vote Alice out!`, async () => {
        const receipt = await bob.functionCall({
            contractId: contractId,
            methodName: 'motion',
            args: {
                description: `Remove Alice (${aliceId}) from her role in the group.`,
                value: true,
            },
            gas: GAS,
            attachedDeposit: 1,
        });
        bobsOpenMotion = JSON.parse(Buffer.from(receipt.status.SuccessValue, 'base64').toString());
        expect(bobsOpenMotion.motion_id).toBeTruthy();
        expect(bobsOpenMotion.status).toBe('OPEN');
    });
    test(`Each indexed user account registers with the contract as a voter, and must be voted in before they can participate. 1 NEAR is required.`, async () => {
        for (index of [1, 2, 3, 4, 5]) {
            const { userAccount } = getUserData(index);
            await userAccount.functionCall({
                contractId: contractId,
                methodName: 'register',
                gas: GAS,
                attachedDeposit: parseNearAmount('1'),
            });
        }
    });
    test(`User 1 tries to vote before being registered.`, async () => {
        const { userAccount } = getUserData(1);
        try {
            await userAccount.functionCall({
                contractId: contractId,
                methodName: 'vote',
                args: {
                    motion_id: bobsOpenMotion.motion_id,
                    value: true,
                },
                gas: GAS,
                attachedDeposit: 1,
            });
        } catch (error) {
            expect(error).toBeTruthy();
        }
    });
    test(`Alice and Bob vote to approve User 1's registration.`, async () => {
        const indexUser = getUserData(1);
        let response = await alice.viewFunction(contractId, 'view_motion_by_description', {
            description: `Add ${indexUser.userId} as a registered user.`,
        });
        await Promise.all([alice, bob].map(userAccount => {
            return userAccount.functionCall({
                contractId: contractId,
                methodName: 'vote',
                args: {
                    motion_id: response.motion.motion_id,
                    value: true,
                },
                gas: GAS,
                attachedDeposit: 1,
            });
        }));
        response = await alice.viewFunction(contractId, 'view_motions', {
            motion_ids: [response.motion.motion_id],
        });
        const { motion, voters } = response[0];
        motion.registered = motion.registered.sort();
        expect(motion).toEqual(
            expect.objectContaining({
                motion_id: motion.motion_id,
                description: `Add ${indexUser.userId} as a registered user.`,
                registered: expect.arrayContaining([
                    aliceId,
                    bobId,
                ]),
                status: 'ADOPTED',
            })
        );
    });
    test(`Alice creates a bet category motion and votes in the opposite of the bet prediction.`, async () => {
        let receipt = await alice.functionCall({
            contractId: contractId,
            methodName: 'motion',
            args: {
                description: JSON.stringify({
                    betId: 'c5VA2k16PbQC_KeOAZTkR',
                    betDetails: '',
                }),
                value: false,
                category: 'bet',
                quorum: 2,
                pool: [aliceId, jillId, bobId],
            },
            gas: GAS,
            attachedDeposit: 1,
        });
        let alicesOpenMotion = JSON.parse(Buffer.from(receipt.status.SuccessValue, 'base64').toString());
        let response = await alice.viewFunction(contractId, 'view_motions', {
            motion_ids: [alicesOpenMotion.motion_id],
        });
        const { motion, voters } = response[0];
        expect(motion).toMatchObject({
            category: 'bet',
            motion_id: alicesOpenMotion.motion_id,
            description: JSON.stringify({
                betId: 'c5VA2k16PbQC_KeOAZTkR',
                betDetails: '',
            }),
            quorum: 2,
            registered: [
                aliceId,
                bobId,
                jillId,
            ],
            status: 'OPEN',
        });
        await new Promise(resolve => setTimeout(resolve, 30000));
        await jill.functionCall({
            contractId: contractId,
            methodName: 'vote',
            args: {
                motion_id: alicesOpenMotion.motion_id,
                value: false,
            },
            gas: GAS,
            attachedDeposit: 1,
        });
        response = await alice.viewFunction(contractId, 'view_motions', {
            motion_ids: [alicesOpenMotion.motion_id],
        });
        const { motion: secondCall } = response[0];
        expect(secondCall).toMatchObject({
            category: 'bet',
            motion_id: alicesOpenMotion.motion_id,
            description: JSON.stringify({
                betId: 'c5VA2k16PbQC_KeOAZTkR',
                betDetails: '',
            }),
            quorum: 2,
            registered: [
                aliceId,
                bobId,
                jillId,
            ],
            status: 'REJECTED',
        });
        console.log({ motion });
    });
    test(`Alice creates another bet category motion and votes in the affirmative of the bet prediction.`, async () => {
        const receipt = await alice.functionCall({
            contractId: contractId,
            methodName: 'motion',
            args: {
                description: JSON.stringify({
                    betId: 'JixWNWsYXVacHF9sQsOFH',
                    betDetails: '',
                }),
                value: true,
                category: 'bet',
                quorum: 2,
                pool: [aliceId, jillId, bobId],
            },
            gas: GAS,
            attachedDeposit: 1,
        });
        const motion = JSON.parse(Buffer.from(receipt.status.SuccessValue, 'base64').toString());
        expect(motion.motion_id).toBeTruthy();
        expect(motion.status).toBe('OPEN');
    });
});
