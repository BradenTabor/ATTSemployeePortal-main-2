import postcss from 'postcss';

// Tailwind's parser helpers call `postcss.parse` without a `from` option.
// PostCSS 8.4.35+ warns about this, so we normalize the options once here.
if (!postcss.__fromPatched) {
  const originalParse = postcss.parse;

  postcss.parse = (css, opts) => {
    const normalizedOpts =
      opts && typeof opts === 'object'
        ? { ...opts }
        : {};

    if (normalizedOpts.from === undefined) {
      normalizedOpts.from = 'inline.css';
    }

    return originalParse(css, normalizedOpts);
  };

  postcss.__fromPatched = true;
}

export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
