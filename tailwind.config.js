/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        'xs': '375px', // Extra small screens (iPhone SE, etc.)
      },
      colors: {
        // WCAG AA compliant secondary text on dark backgrounds (#0a0f0d ~ #111827)
        accessibleMuted: '#b0b8c4',
      },
    },
  },
  plugins: [],
};
