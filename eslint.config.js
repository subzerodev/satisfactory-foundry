import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  ...tseslint.configs.recommended,
  {
    // Purity boundary for src/core/**: core is zero-dependency pure TS with no
    // knowledge of the other layers. This is an allowlist — every package import
    // is banned (a future dep can never silently leak in), plus a depth-robust
    // ban on relative escapes to the state/ui/data layers, plus dynamic imports
    // and host globals. Type-only imports are banned too (allowTypeImports
    // stays false): core must not even type-depend on the other layers.
    files: ['src/core/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Ban every bare-specifier (package) import: anything not
              // starting with "." is a package. Keeps core zero-dependency.
              regex: '^[^.]',
              message:
                'src/core is zero-dependency: no package imports allowed.',
            },
            {
              // Depth-robust ban on relative escapes into sibling layers,
              // matching ../state, ../../state/foo, ../../../data/x, etc. at
              // any nesting depth.
              regex: '^\\.\\./(\\.\\./)*(state|ui|data)(/|$)',
              message:
                'src/core must not import from the state/ui/data layers.',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          // Close the dynamic-import hole: no-restricted-imports covers static
          // imports only.
          selector: 'ImportExpression',
          message:
            'src/core is zero-dependency: dynamic imports are not allowed.',
        },
      ],
      'no-restricted-globals': [
        'error',
        {
          // checkGlobalObject also catches globalThis.document-style access,
          // not just bare identifiers. Verified supported in ESLint 10.8.0.
          checkGlobalObject: true,
          globals: [
            'document',
            'window',
            'indexedDB',
            'localStorage',
            'sessionStorage',
            'fetch',
            'navigator',
            'location',
          ],
        },
      ],
    },
  },
)
