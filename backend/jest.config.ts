import type { Config } from 'jest';

/**
 * Jest config for the backend.
 *
 * ts-jest transforms TypeScript on-the-fly so we don't need a compile step.
 * moduleNameMapper strips the .js extension from imports — TypeScript backend
 * uses .js in import paths for Node ESM compatibility, but Jest runs in CJS.
 */
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    // Strip .js from imports — ts-jest resolves .ts files, not .js
    '^(\\.\\.?/.*)\\.js$': '$1',
  },
  // Load environment variables for tests
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  // Don't collect coverage from data files or scripts
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/data/**',
    '!src/scripts/**',
    '!src/__tests__/**',
  ],
};

export default config;
