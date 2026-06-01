// Minimal ESLint flat config using @eslint/js recommended rules
// Use CommonJS extension because package.json sets "type": "module".
// Use the @eslint/js recommended flat config, but ignore generated and vendor files.
module.exports = [
	require('@eslint/js').configs.recommended,
	{
		ignores: ['dist/**', 'node_modules/**', '.vercel/**', '.wrangler/**'],
	},
];
