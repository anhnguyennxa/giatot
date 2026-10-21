import type { Config } from 'tailwindcss';

// Bảng màu lấy theo nhận diện thương hiệu Giá Tốt (logo).
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#D9480F', dark: '#B23A0B', light: '#FDEDE4', soft: '#FFF6F1' },
        gold: { DEFAULT: '#FFC233', light: '#FFF3D1', dark: '#8A6100' },
        ink: { DEFAULT: '#1F1A17', soft: '#4A423D' },
        muted: '#7A706A',
        line: '#E8E1DA',
        canvas: '#F6F3EF',
        ok: { DEFAULT: '#15803D', light: '#E7F5EC' },
        warn: '#C98A00',
      },
      fontFamily: { sans: ['var(--font-be-vietnam)', 'system-ui', 'sans-serif'] },
      maxWidth: { site: '1200px' },
    },
  },
  plugins: [],
};

export default config;
