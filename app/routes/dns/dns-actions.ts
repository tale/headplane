import { ActionFunctionArgs, data } from 'react-router';
import { LoadContext } from '~/server';
import { Capabilities } from '~/server/web/roles';

export async function dnsAction({
	request,
	context,
}: ActionFunctionArgs<LoadContext>) {
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

	const formData = await request.formData();
	const action = formData.get('action_id')?.toString();
	if (!action) {
		return data({ success: false }, 400);
	}

	switch (action) {
		case 'rename_tailnet':
			return renameTailnet(formData, context);
		case 'toggle_magic':
			return toggleMagic(formData, context);
		case 'remove_ns':
			return removeNs(formData, context);
		case 'add_ns':
			return addNs(formData, context);
		case 'remove_domain':
			return removeDomain(formData, context);
		case 'add_domain':
			return addDomain(formData, context);
		case 'remove_record':
			return removeRecord(formData, context);
		case 'add_record':
			return addRecord(formData, context);
		default:
			return data({ success: false }, 400);
	}
}

async function renameTailnet(formData: FormData, context: LoadContext) {
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

	await context.integration?.onConfigChange(context.client);
}

async function toggleMagic(formData: FormData, context: LoadContext) {
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

	await context.integration?.onConfigChange(context.client);
}

async function removeNs(formData: FormData, context: LoadContext) {
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
				value: servers,
			},
		]);
	}

	await context.integration?.onConfigChange(context.client);
}

async function addNs(formData: FormData, context: LoadContext) {
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

	await context.integration?.onConfigChange(context.client);
}

async function removeDomain(formData: FormData, context: LoadContext) {
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

	await context.integration?.onConfigChange(context.client);
}

async function addDomain(formData: FormData, context: LoadContext) {
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

	await context.integration?.onConfigChange(context.client);
}

async function removeRecord(formData: FormData, context: LoadContext) {
	const config = context.hs.c!;
	const recordName = formData.get('record_name')?.toString();
	const recordType = formData.get('record_type')?.toString();

	if (!recordName || !recordType) {
		return data({ success: false }, 400);
	}

	const records = config.dns.extra_records.filter(
		(i) => i.name !== recordName || i.type !== recordType,
	);

	await context.hs.patch([
		{
			path: 'dns.extra_records',
			value: records,
		},
	]);

	await context.integration?.onConfigChange(context.client);
}

async function addRecord(formData: FormData, context: LoadContext) {
	const config = context.hs.c!;
	const recordName = formData.get('record_name')?.toString();
	const recordType = formData.get('record_type')?.toString();
	const recordValue = formData.get('record_value')?.toString();

	if (!recordName || !recordType || !recordValue) {
		return data({ success: false }, 400);
	}

	const records = config.dns.extra_records;
	records.push({ name: recordName, type: recordType, value: recordValue });

	await context.hs.patch([
		{
			path: 'dns.extra_records',
			value: records,
		},
	]);

	await context.integration?.onConfigChange(context.client);
}
