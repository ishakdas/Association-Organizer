import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FlatCompat } from '@eslint/eslintrc';

const appDirectory = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: appDirectory });

export default [
  { ignores: ['.next/**', 'node_modules/**', 'coverage/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];
