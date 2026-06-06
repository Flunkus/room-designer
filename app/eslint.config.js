import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Cohesive modules intentionally co-export a component with a related
      // constant/helper (Icon+TYPE_ICON, Walls+buildWalls, …). This only affects
      // dev Fast Refresh granularity, not correctness — keep it advisory.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
])
