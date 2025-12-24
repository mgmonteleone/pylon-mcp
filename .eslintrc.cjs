module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'vitest'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    'no-console': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'vitest/no-focused-tests': 'error',
    'vitest/no-identical-title': 'error',
    'vitest/expect-expect': 'warn',
  },
  ignorePatterns: ['dist', '**/*.d.ts'],
  overrides: [
    {
      files: ['tests/**/*.{ts,tsx}'],
      env: { node: true },
      rules: {
        'no-console': 'off',
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
  ],
};
