import { defineConfig } from 'vitepress';

export default defineConfig({
	title: 'Headplane',
	description: 'The missing dashboard for Headscale',
	ignoreDeadLinks: ['/docs/Integrated-Mode', '/docs/Simple-Mode'],
	cleanUrls: true,
	head: [['link', { rel: 'icon', href: '/favicon.ico' }]],
	themeConfig: {
		logo: '/logo-dark-bg.svg',
		nav: [{ text: 'Home', link: '/' }],
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
			{ icon: 'githubsponsors', link: 'https://github.com/sponsors/tale' },
			{ icon: 'kofi', link: 'https://ko-fi.com/atale' },
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
