module.exports = {
    verbose: true,
    testEnvironment: 'node',
    testTimeout: 60000,
    maxConcurrency: 10,
    globals: {
        Uint8Array: Uint8Array,
        __APP__: undefined,
    },
    //globalSetup: '<rootDir>/test/setup.js',
    projects: [
        { displayName: 'main', testRegex: 'app.test.js' },
        { displayName: 'voting', testRegex: 'voting.test.js' },
    ],
};
