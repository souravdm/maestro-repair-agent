/**
 * Test Data Loader
 * Reads user test data from .maestro/testdata/users_<env>.js
 * Those files are Maestro-runtime scripts, so we use vm to safely extract TEST_DATA.
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const TESTDATA_DIR = path.resolve(__dirname, '../../../../.maestro/testdata');

/**
 * Load the full TEST_DATA object from the Maestro testdata file.
 * @param {string} env - 'qa', 'qa2' (maps to 'qa'), or 'prod'
 * @returns {Object} TEST_DATA keyed by user identifier
 */
function loadTestData(env = 'qa') {
  // Map qa2 to qa for test data file lookup
  const testDataEnv = env === 'qa2' ? 'qa' : env;
  const filePath = path.join(TESTDATA_DIR, `users_${testDataEnv}.js`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Test data file not found: ${filePath}`);
  }

  const code = fs.readFileSync(filePath, 'utf8');

  // Wrap in an IIFE so we can return TEST_DATA.
  // Mock Maestro globals (output, loginData) so the bottom of the file is a no-op.
  // Provide default loginData to prevent error when loading test data
  const wrapped = `(function() {
    var output = {};
    var loginData = "LOA2";
    ${code}
    return TEST_DATA;
  })()`;

  return vm.runInNewContext(wrapped, { process });
}

/**
 * Get a single user by key.
 * @param {string} key - e.g. 'LOA2', 'SUMMER_PE'
 * @param {string} env
 */
function getUser(key, env = 'qa') {
  const data = loadTestData(env);
  if (!data[key]) {
    const available = Object.keys(data).join(', ');
    throw new Error(`User "${key}" not found in test data (${env}). Available: ${available}`);
  }
  return { key, ...data[key] };
}

/**
 * Get all users as an array with their key attached.
 * @param {string} env
 * @param {string[]} [filter] - optional list of keys to include
 */
function getUsers(env = 'qa', filter = null) {
  const data = loadTestData(env);
  const keys = filter ? filter : Object.keys(data);
  return keys.map(key => {
    if (!data[key]) throw new Error(`User "${key}" not found in test data (${env}).`);
    return { key, ...data[key] };
  });
}

/**
 * List all available user keys.
 * @param {string} env
 */
function getUserKeys(env = 'qa') {
  return Object.keys(loadTestData(env));
}

module.exports = { loadTestData, getUser, getUsers, getUserKeys };
