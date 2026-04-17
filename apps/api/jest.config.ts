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
    '^@ticketbot/database$': '<rootDir>/../../libs/database/src/index.ts',
    '^@ticketbot/shared-types$': '<rootDir>/../../libs/shared-types/src/index.ts',
    '^@ticketbot/shared-validation$': '<rootDir>/../../libs/shared-validation/src/index.ts',
    '^@ticketbot/core$': '<rootDir>/../../libs/core/src/index.ts',
    '^@ticketbot/ai$': '<rootDir>/../../libs/ai/src/index.ts',
  },
};

export default config;
