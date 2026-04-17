import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@ticketbot/shared-validation$': '<rootDir>/../shared-validation/src/index.ts',
    '^@ticketbot/shared-types$': '<rootDir>/../shared-types/src/index.ts',
  },
};

export default config;
