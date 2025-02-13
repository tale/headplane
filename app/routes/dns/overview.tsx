import type { ActionFunctionArgs } from 'react-router';
import { useLoaderData } from 'react-router';
import Code from '~/components/Code';
import Notice from '~/components/Notice';
import { hs_getConfig } from '~/utils/state';
import ManageDomains from './components/manage-domains';
import ManageNS from './components/manage-ns';
import ManageRecords from './components/manage-records';
import RenameTailnet from './components/rename-tailnet';
import ToggleMagic from './components/toggle-magic';
import { dnsAction } from './dns-actions';

// We do not want to expose every config value
export async function loader() {
	const { config, mode } = hs_getConfig();
	if (mode === 'no') {
		throw new Error('No configuration is available');
	}

	const dns = {
		prefixes: config.prefixes,
		magicDns: config.dns.magic_dns,
		baseDomain: config.dns.base_domain,
		nameservers: config.dns.nameservers.global,
		splitDns: config.dns.nameservers.split,
		searchDomains: config.dns.search_domains,
		extraRecords: config.dns.extra_records,
	};

	return {
		...dns,
		mode,
	};
}

export async function action(data: ActionFunctionArgs) {
	return dnsAction(data);
}

export default function Page() {
	const data = useLoaderData<typeof loader>();

	const allNs: Record<string, string[]> = {};
	for (const key of Object.keys(data.splitDns)) {
		allNs[key] = data.splitDns[key];
	}

	allNs.global = data.nameservers;
	const isDisabled = data.mode !== 'rw';

	return (
		<div className="flex flex-col gap-16 max-w-screen-lg">
			{data.mode === 'rw' ? undefined : (
				<Notice>
					The Headscale configuration is read-only. You cannot make changes to
					the configuration
				</Notice>
			)}
			<RenameTailnet name={data.baseDomain} isDisabled={isDisabled} />
			<ManageNS nameservers={allNs} isDisabled={isDisabled} />
			<ManageRecords records={data.extraRecords} isDisabled={isDisabled} />
			<ManageDomains
				searchDomains={data.searchDomains}
				isDisabled={isDisabled}
				magic={data.magicDns ? data.baseDomain : undefined}
			/>

			<div className="flex flex-col w-2/3">
				<h1 className="text-2xl font-medium mb-4">Magic DNS</h1>
				<p className="mb-4">
					Automatically register domain names for each device on the tailnet.
					Devices will be accessible at{' '}
					<Code>
						[device].
						{data.baseDomain}
					</Code>{' '}
					when Magic DNS is enabled.
				</p>
				<ToggleMagic isEnabled={data.magicDns} isDisabled={isDisabled} />
			</div>
		</div>
	);
}
