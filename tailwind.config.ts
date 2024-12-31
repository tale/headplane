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
			height: {
				editor: 'calc(100vh - 20rem)',
			},
			colors: {
				main: colors.slate,
				ui: colors.neutral,
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
