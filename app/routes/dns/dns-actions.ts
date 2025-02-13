import { ActionFunctionArgs, data } from 'react-router';
import { hs_patchConfig } from '~/utils/config/loader';
import { auth } from '~/utils/sessions.server';
import { hs_getConfig } from '~/utils/state';

export async function dnsAction({ request }: ActionFunctionArgs) {
	const session = await auth(request);
	if (!session) {
		return data({ success: false }, 401);
	}

	const { mode } = hs_getConfig();
	if (mode !== 'rw') {
		return data({ success: false }, 403);
	}

	const formData = await request.formData();
	const action = formData.get('action_id')?.toString();
	if (!action) {
		return data({ success: false }, 400);
	}

	switch (action) {
		case 'rename_tailnet':
			return renameTailnet(formData);
		case 'toggle_magic':
			return toggleMagic(formData);
		case 'remove_ns':
			return removeNs(formData);
		case 'add_ns':
			return addNs(formData);
		case 'remove_domain':
			return removeDomain(formData);
		case 'add_domain':
			return addDomain(formData);
		case 'remove_record':
			return removeRecord(formData);
		case 'add_record':
			return addRecord(formData);
		default:
			return data({ success: false }, 400);
	}

	// TODO: Integration update
}

async function renameTailnet(formData: FormData) {
	const newName = formData.get('new_name')?.toString();
	if (!newName) {
		return data({ success: false }, 400);
	}

	await hs_patchConfig([
		{
			path: 'dns.base_domain',
			value: newName,
		},
	]);
}

async function toggleMagic(formData: FormData) {
	const newState = formData.get('new_state')?.toString();
	if (!newState) {
		return data({ success: false }, 400);
	}

	await hs_patchConfig([
		{
			path: 'dns.magic_dns',
			value: newState === 'enabled',
		},
	]);
}

async function removeNs(formData: FormData) {
	const ns = formData.get('ns')?.toString();
	const splitName = formData.get('split_name')?.toString();

	if (!ns || !splitName) {
		return data({ success: false }, 400);
	}

	const { config, mode } = hs_getConfig();
	if (mode !== 'rw') {
		return data({ success: false }, 403);
	}

	if (splitName === 'global') {
		const servers = config.dns.nameservers.global.filter((i) => i !== ns);

		await hs_patchConfig([
			{
				path: 'dns.nameservers.global',
				value: servers,
			},
		]);
	} else {
		const splits = config.dns.nameservers.split;
		const servers = splits[splitName].filter((i) => i !== ns);

		await hs_patchConfig([
			{
				path: `dns.nameservers.split."${splitName}"`,
				value: servers,
			},
		]);
	}
}

async function addNs(formData: FormData) {
	const ns = formData.get('ns')?.toString();
	const splitName = formData.get('split_name')?.toString();

	if (!ns || !splitName) {
		return data({ success: false }, 400);
	}

	const { config, mode } = hs_getConfig();
	if (mode !== 'rw') {
		return data({ success: false }, 403);
	}

	if (splitName === 'global') {
		const servers = config.dns.nameservers.global;
		servers.push(ns);

		await hs_patchConfig([
			{
				path: 'dns.nameservers.global',
				value: servers,
			},
		]);
	} else {
		const splits = config.dns.nameservers.split;
		const servers = splits[splitName] ?? [];
		servers.push(ns);

		await hs_patchConfig([
			{
				path: `dns.nameservers.split."${splitName}"`,
				value: servers,
			},
		]);
	}
}

async function removeDomain(formData: FormData) {
	const domain = formData.get('domain')?.toString();
	if (!domain) {
		return data({ success: false }, 400);
	}

	const { config, mode } = hs_getConfig();
	if (mode !== 'rw') {
		return data({ success: false }, 403);
	}

	const domains = config.dns.search_domains.filter((i) => i !== domain);

	await hs_patchConfig([
		{
			path: 'dns.search_domains',
			value: domains,
		},
	]);
}

async function addDomain(formData: FormData) {
	const domain = formData.get('domain')?.toString();
	if (!domain) {
		return data({ success: false }, 400);
	}

	const { config, mode } = hs_getConfig();
	if (mode !== 'rw') {
		return data({ success: false }, 403);
	}

	const domains = config.dns.search_domains;
	domains.push(domain);

	await hs_patchConfig([
		{
			path: 'dns.search_domains',
			value: domains,
		},
	]);
}

async function removeRecord(formData: FormData) {
	const recordName = formData.get('record_name')?.toString();
	const recordType = formData.get('record_type')?.toString();

	if (!recordName || !recordType) {
		return data({ success: false }, 400);
	}

	const { config, mode } = hs_getConfig();
	if (mode !== 'rw') {
		return data({ success: false }, 403);
	}

	const records = config.dns.extra_records.filter(
		(i) => i.name !== recordName || i.type !== recordType,
	);

	await hs_patchConfig([
		{
			path: 'dns.extra_records',
			value: records,
		},
	]);
}

async function addRecord(formData: FormData) {
	const recordName = formData.get('record_name')?.toString();
	const recordType = formData.get('record_type')?.toString();
	const recordValue = formData.get('record_value')?.toString();

	if (!recordName || !recordType || !recordValue) {
		return data({ success: false }, 400);
	}

	const { config, mode } = hs_getConfig();
	if (mode !== 'rw') {
		return data({ success: false }, 403);
	}

	const records = config.dns.extra_records;
	records.push({ name: recordName, type: recordType, value: recordValue });

	await hs_patchConfig([
		{
			path: 'dns.extra_records',
			value: records,
		},
	]);
}
