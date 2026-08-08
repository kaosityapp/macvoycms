import type { Config } from 'tailwindcss';

// Brand palette from the MacVoy logo: hot-magenta clover + black wordmark.
// Type is Montserrat (matched to the current site).
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: '#1a1a1a', // near-black — body text + "black" buttons (from wordmark)
          pink: '#d10f8c', // deep brand magenta — primary buttons/links (white-text safe)
          pinkdark: '#a80c70', // hover / pressed
          pinkbright: '#fe2bfe', // literal logo magenta — decorative accents only
          bg: '#f9fafb', // page background
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Montserrat', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
