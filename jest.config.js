/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  collectCoverage: false,
  extensionsToTreatAsEsm: ['.ts'],
  globals: {
    'ts-jest': {
      useESM: true,
    },
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)'
  ]
};
