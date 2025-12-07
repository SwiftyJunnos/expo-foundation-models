module.exports = {
  root: true,
  extends: ['universe/native', 'universe/web'],
  ignorePatterns: ['build', 'node_modules', '*.d.ts'],
  rules: {
    // Enforce consistent import ordering
    'import/order': ['warn', {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      'newlines-between': 'never',
      alphabetize: {
        order: 'asc',
        caseInsensitive: true,
      },
    }],
    // Prevent accidental console.log in production
    'no-console': 'warn',
  },
};
