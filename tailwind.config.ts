/* eslint-disable @typescript-eslint/naming-convention */
import type { Config } from 'tailwindcss'

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
				'2xl': '6rem'
			}
		},
		extend: {
			height: {
				editor: 'calc(100vh - 20rem)'
			}
		}
	},
	plugins: []
} satisfies Config

