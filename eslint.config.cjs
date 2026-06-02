// Minimal ESLint flat config using @eslint/js recommended rules and Node/TypeScript support.
// Use CommonJS extension because package.json sets "type": "module".
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
	require('@eslint/js').configs.recommended,
	{
		ignores: ['dist/**', 'node_modules/**', '.vercel/**', '.wrangler/**'],
		rules: {
			'no-undef': 'off',
			'no-unused-vars': 'off',
		},
		languageOptions: {
			parserOptions: {
				ecmaVersion: 2024,
				sourceType: 'module',
				ecmaFeatures: { jsx: true },
			},
			globals: {
				process: 'readonly',
				console: 'readonly',
				Buffer: 'readonly',
				fetch: 'readonly',
				URL: 'readonly',
				TextEncoder: 'readonly',
				TextDecoder: 'readonly',
				AbortSignal: 'readonly',
				FormData: 'readonly',
				Headers: 'readonly',
				Request: 'readonly',
				Response: 'readonly',
				TransformStream: 'readonly',
				ReadableStream: 'readonly',
				structuredClone: 'readonly',
				setTimeout: 'readonly',
				setInterval: 'readonly',
				clearTimeout: 'readonly',
				clearInterval: 'readonly',
				queueMicrotask: 'readonly',
				crypto: 'readonly',
				window: 'readonly',
				document: 'readonly',
				React: 'readonly',
			},
		},
	},
	{
		files: ['**/*.ts', '**/*.tsx'],
		plugins: { '@typescript-eslint': tsPlugin },
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				ecmaVersion: 2024,
				sourceType: 'module',
				project: './tsconfig.json',
				extraFileExtensions: ['.ts', '.tsx'],
			},
		},
		rules: {
			...tsPlugin.configs.recommended.rules,
			'no-undef': 'off',
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
		},
	},
];
