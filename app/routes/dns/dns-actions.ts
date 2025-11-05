import { data } from 'react-router';
import { Capabilities } from '~/server/web/roles';
import type { Route } from './+types/overview';

export async function dnsAction({ request, context }: Route.ActionArgs) {
	const check = await context.sessions.check(
		request,
		Capabilities.write_network,
	);

	if (!check) {
		return data({ success: false }, 403);
	}

	if (!context.hs.writable()) {
		return data({ success: false }, 403);
	}

	// We only need it for health checks which don't require auth
	const api = context.hsApi.getRuntimeClient('fake-api-key');

	const formData = await request.formData();
	const action = formData.get('action_id')?.toString();
	if (!action) {
		return data({ success: false }, 400);
	}

	switch (action) {
		case 'rename_tailnet': {
			const newName = formData.get('new_name')?.toString();
			if (!newName) {
				return data({ success: false }, 400);
			}

			await context.hs.patch([
				{
					path: 'dns.base_domain',
					value: newName,
				},
			]);

			await context.integration?.onConfigChange(api);
			return { message: 'Tailnet renamed successfully' };
		}
		case 'toggle_magic': {
			const newState = formData.get('new_state')?.toString();
			if (!newState) {
				return data({ success: false }, 400);
			}

			await context.hs.patch([
				{
					path: 'dns.magic_dns',
					value: newState === 'enabled',
				},
			]);

			await context.integration?.onConfigChange(api);
			return { message: 'Magic DNS state updated successfully' };
		}
		case 'remove_ns': {
			const config = context.hs.c!;
			const ns = formData.get('ns')?.toString();
			const splitName = formData.get('split_name')?.toString();

			if (!ns || !splitName) {
				return data({ success: false }, 400);
			}

			if (splitName === 'global') {
				const servers = config.dns.nameservers.global.filter((i) => i !== ns);

				await context.hs.patch([
					{
						path: 'dns.nameservers.global',
						value: servers,
					},
				]);
			} else {
				const splits = config.dns.nameservers.split;
				const servers = splits[splitName].filter((i) => i !== ns);

				await context.hs.patch([
					{
						path: `dns.nameservers.split."${splitName}"`,
						value: servers.length > 0 ? servers : null,
					},
				]);
			}

			await context.integration?.onConfigChange(api);
			return { message: 'Nameserver removed successfully' };
		}
		case 'add_ns': {
			const config = context.hs.c!;
			const ns = formData.get('ns')?.toString();
			const splitName = formData.get('split_name')?.toString();

			if (!ns || !splitName) {
				return data({ success: false }, 400);
			}

			if (splitName === 'global') {
				const servers = config.dns.nameservers.global;
				servers.push(ns);

				await context.hs.patch([
					{
						path: 'dns.nameservers.global',
						value: servers,
					},
				]);
			} else {
				const splits = config.dns.nameservers.split;
				const servers = splits[splitName] ?? [];
				servers.push(ns);

				await context.hs.patch([
					{
						path: `dns.nameservers.split."${splitName}"`,
						value: servers,
					},
				]);
			}

			await context.integration?.onConfigChange(api);
			return { message: 'Nameserver added successfully' };
		}
		case 'remove_domain': {
			const config = context.hs.c!;
			const domain = formData.get('domain')?.toString();
			if (!domain) {
				return data({ success: false }, 400);
			}

			const domains = config.dns.search_domains.filter((i) => i !== domain);
			await context.hs.patch([
				{
					path: 'dns.search_domains',
					value: domains,
				},
			]);

			await context.integration?.onConfigChange(api);
			return { message: 'Domain removed successfully' };
		}
		case 'add_domain': {
			const config = context.hs.c!;
			const domain = formData.get('domain')?.toString();
			if (!domain) {
				return data({ success: false }, 400);
			}

			const domains = config.dns.search_domains;
			domains.push(domain);

			await context.hs.patch([
				{
					path: 'dns.search_domains',
					value: domains,
				},
			]);

			await context.integration?.onConfigChange(api);
			return { message: 'Domain added successfully' };
		}
		case 'remove_record': {
			const recordName = formData.get('record_name')?.toString();
			const recordType = formData.get('record_type')?.toString();

			if (!recordName || !recordType) {
				return data({ success: false }, 400);
			}

			// Value is not needed for removal
			const restart = await context.hs.removeDNS({
				name: recordName,
				type: recordType,
				value: '',
			});

			if (!restart) {
				return;
			}

			await context.integration?.onConfigChange(api);
			return { message: 'DNS record removed successfully' };
		}
		case 'add_record': {
			const recordName = formData.get('record_name')?.toString();
			const recordType = formData.get('record_type')?.toString();
			const recordValue = formData.get('record_value')?.toString();

			if (!recordName || !recordType || !recordValue) {
				return data({ success: false }, 400);
			}

			const restart = await context.hs.addDNS({
				name: recordName,
				type: recordType,
				value: recordValue,
			});

			if (!restart) {
				return;
			}

			await context.integration?.onConfigChange(api);
			return { message: 'DNS record added successfully' };
		}
		case 'override_dns': {
			const override = formData.get('override_dns')?.toString();
			if (!override) {
				return data({ success: false }, 400);
			}

			const overrideValue = override === 'true';
			await context.hs.patch([
				{
					path: 'dns.override_local_dns',
					value: overrideValue,
				},
			]);

			await context.integration?.onConfigChange(api);
			return { message: 'DNS override updated successfully' };
		}
		default:
			return data({ success: false }, 400);
	}
}
