import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

// ESLint 9 reads flat config only; without this file `npm run lint` exits with "couldn't find
// eslint.config" and nothing has ever linted. eslint-config-next 16 exports a flat array directly.
export default [
  { ignores: ['.next/**', '.next-verify/**', 'node_modules/**', 'public/**'] },
  ...nextCoreWebVitals,
  {
    rules: {
      // Downgraded, not disabled: the codebase leans on the two-pass hydration pattern
      // (useHasMounted and friends), which this compiler-era rule flags in ~12 places. They are
      // deliberate and load-bearing; rewriting them is its own project. New code should still
      // heed the warning.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
];
