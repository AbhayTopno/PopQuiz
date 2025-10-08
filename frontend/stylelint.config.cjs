// frontend/stylelint.config.cjs
module.exports = {
  extends: [
    'stylelint-config-standard',
    'stylelint-config-prettier',
    'stylelint-config-tailwindcss',
  ],
  rules: {
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: [
          'tailwind', // Tailwind directives
          'apply',
          'variants',
          'responsive',
          'screen',
        ],
      },
    ],
    'no-empty-source': null, // allow empty CSS files (sometimes needed in Tailwind projects)
    'block-no-empty': null,
  },
};
