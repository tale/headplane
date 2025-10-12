import { defineConfig } from 'vitepress';

export default defineConfig({
	title: 'Headplane',
	description: 'The missing dashboard for Headscale',
	ignoreDeadLinks: ['/docs/Integrated-Mode', '/docs/Simple-Mode'],
	cleanUrls: true,
	themeConfig: {
		nav: [
			{ text: 'Home', link: '/' },
			{ text: 'Sponsor Headplane', link: 'https://github.com/sponsors/tale' },
		],
		sidebar: [
			{
				text: 'Chapters',
				items: [
					{ text: 'Getting Started', link: '/README' },
					{ text: 'Configuration', link: '/Configuration' },
					{ text: 'Bare-Metal Mode', link: '/Bare-Metal' },
					{ text: 'Integrated Mode', link: '/Integrated-Mode' },
					{ text: 'Simple Mode', link: '/Simple-Mode' },
					{ text: 'Nix', link: '/Nix' },
					{ text: 'NixOS', link: '/NixOS-options' },
					{ text: 'Security', link: '/SECURITY' },
					{ text: 'Contributing', link: '/CONTRIBUTING' },
					{ text: 'Changelog', link: '/CHANGELOG' },
				],
			},
		],

		socialLinks: [
			{ icon: 'github', link: 'https://github.com/tale/headplane' },
		],

		lastUpdated: {
			text: 'Updated at',
			formatOptions: {
				dateStyle: 'full',
				timeStyle: 'medium',
			},
		},
	},
});
