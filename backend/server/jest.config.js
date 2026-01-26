/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  transform: {},
  moduleFileExtensions: ['js', 'mjs'],
  testMatch: ['**/tests/**/*.test.js'],
  testTimeout: 10000,
  forceExit: true,
  collectCoverageFrom: [
    '*.js',
    'utils/*.js',
    '!index.js',
    '!jest.config.js',
    '!test-*.js'
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 90,
      lines: 85,
      statements: 85
    }
  }
};
