module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'services/**/*.js',
    'routes/**/*.js',
    'middleware/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/coverage/**'
  ],

  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    },
    './services/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Module paths
  moduleDirectories: ['node_modules', '<rootDir>'],

  // Test timeout
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Transform configuration
  transform: {
    '^.+\\.js$': 'babel-jest'
  },

  // Module name mapping for absolute imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@services/(.*)$': '<rootDir>/services/$1',
    '^@routes/(.*)$': '<rootDir>/routes/$1',
    '^@middleware/(.*)$': '<rootDir>/middleware/$1',
    '^@models/(.*)$': '<rootDir>/models/$1'
  },

  // Global variables
  globals: {
    'process.env.NODE_ENV': 'test'
  },

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/logs/'
  ],

  // Watch plugins (commented out as packages not installed)
  // watchPlugins: [
  //   'jest-watch-typeahead/filename',
  //   'jest-watch-typeahead/testname'
  // ],

  // Error handling
  errorOnDeprecated: true,

  // Detect open handles
  detectOpenHandles: true,

  // Force exit after tests complete
  forceExit: true,

  // Max workers for parallel execution
  maxWorkers: '50%'
};
