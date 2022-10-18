const testUtils = require('./test-utils');

const { initContract } = testUtils;

module.exports = async (globalConfig, projectConfig) => {
    await initContract();
};