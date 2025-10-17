import { defineConfig } from 'vitepress';

export default defineConfig({
	title: 'Headplane',
	description: 'The missing dashboard for Headscale',
	cleanUrls: true,
	head: [['link', { rel: 'icon', href: '/favicon.ico' }]],
	themeConfig: {
		logo: '/logo.svg',
		nav: [{ text: 'Home', link: '/' }],
		sidebar: [
			{
				text: 'Getting Started',
				items: [
					{ text: 'What is Headplane?', link: '/introduction' },
					{
						text: 'Installation',
						link: '/install',
						items: [
							{ text: 'Limited Mode', link: '/install/limited-mode' },
							{ text: 'Native Mode', link: '/install/native-mode' },
							{ text: 'Docker', link: '/install/docker' },
						],
					},
					{ text: 'Configuration', link: '/Configuration' },
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
