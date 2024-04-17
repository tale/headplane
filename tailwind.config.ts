import type { Config } from 'tailwindcss'

export default {
	content: ['./app/**/*.{js,jsx,ts,tsx}'],
	theme: {
		extend: {
			height: {
				editor: 'calc(100vh - 20rem)'
			}
		}
	},
	plugins: []
} satisfies Config

