/* eslint-disable @typescript-eslint/naming-convention */
import type { Config } from 'tailwindcss';
import colors from 'tailwindcss/colors';
import animate from 'tailwindcss-animate';
import aria from 'tailwindcss-react-aria-components';

export default {
	content: ['./app/**/*.{js,jsx,ts,tsx}'],
	theme: {
		container: {
			center: true,
			padding: {
				DEFAULT: '1rem',
				sm: '2rem',
				lg: '4rem',
				xl: '5rem',
				'2xl': '6rem',
			},
		},
		extend: {
			blur: {
				xs: '2px',
			},
			height: {
				editor: 'calc(100vh - 20rem)',
			},
			fontFamily: {
				sans: [
					'Inter',
					'-apple-system',
					'BlinkMacSystemFont',
					'Helvetica',
					'Arial',
					'sans-serif',
				],
			},
			transitionDuration: {
				25: '25ms',
				50: '50ms',
			},
			colors: {
				main: colors.slate,
				ui: colors.neutral,
				headplane: {
					50: '#F2F2F2',
					100: '#E6E6E6',
					200: '#CCCCCC',
					300: '#B3B3B3',
					400: '#999999',
					500: '#808080',
					600: '#666666',
					700: '#4D4D4D',
					800: '#343434',
					900: '#1A1A1A',
					950: '#0D0D0D',
				},
			},
			keyframes: {
				loader: {
					from: {
						transform: 'translateX(-100%)',
					},
					to: {
						transform: 'translateX(100%)',
					},
				},
			},
			animation: {
				loading: 'loader 0.8s infinite ease-in-out',
			},
		},
	},
	plugins: [animate, aria],
} satisfies Config;
