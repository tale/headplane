import { RepoForkedIcon } from '@primer/octicons-react';
import { Form, useSubmit } from 'react-router';
import { useState } from 'react';

import Dialog from '~/components/Dialog';
import Switch from '~/components/Switch';
import TextField from '~/components/TextField';
import Tooltip from '~/components/Tooltip';
import { cn } from '~/utils/cn';

interface Props {
	nameservers: Record<string, string[]>;
}

export default function AddNameserver({ nameservers }: Props) {
	const submit = useSubmit();
	const [split, setSplit] = useState(false);
	const [ns, setNs] = useState('');
	const [domain, setDomain] = useState('');

	return (
		<Dialog>
			<Dialog.Button>Add nameserver</Dialog.Button>
			<Dialog.Panel>
				{(close) => (
					<>
						<Dialog.Title>Add nameserver</Dialog.Title>
						<Dialog.Text className="font-semibold">Nameserver</Dialog.Text>
						<Dialog.Text className="text-sm">
							Use this IPv4 or IPv6 address to resolve names.
						</Dialog.Text>
						<Form
							method="POST"
							onSubmit={(event) => {
								event.preventDefault();
								if (!ns) return;

								if (split) {
									const splitNs: Record<string, string[]> = {};
									for (const [key, value] of Object.entries(nameservers)) {
										if (key === 'global') continue;
										splitNs[key] = value;
									}

									if (Object.keys(splitNs).includes(domain)) {
										splitNs[domain].push(ns);
									} else {
										splitNs[domain] = [ns];
									}

									submit(
										{
											'dns.nameservers.split': splitNs,
										},
										{
											method: 'PATCH',
											encType: 'application/json',
										},
									);
								} else {
									const globalNs = nameservers.global;
									globalNs.push(ns);

									submit(
										{
											'dns.nameservers.global': globalNs,
										},
										{
											method: 'PATCH',
											encType: 'application/json',
										},
									);
								}

								setNs('');
								setDomain('');
								setSplit(false);
								close();
							}}
						>
							<TextField
								label="DNS Server"
								placeholder="1.2.3.4"
								name="ns"
								state={[ns, setNs]}
								className="mt-2 mb-8"
							/>
							<div className="flex items-center justify-between">
								<div className="block">
									<div className="inline-flex items-center gap-2">
										<Dialog.Text className="font-semibold">
											Restrict to domain
										</Dialog.Text>
										<Tooltip>
											<Tooltip.Button
												className={cn(
													'text-xs rounded-md px-1.5 py-0.5',
													'bg-ui-200 dark:bg-ui-800',
													'text-ui-600 dark:text-ui-300',
												)}
											>
												<RepoForkedIcon className="w-4 h-4 mr-0.5" />
												Split DNS
											</Tooltip.Button>
											<Tooltip.Body>
												Only clients that support split DNS (Tailscale v1.8 or
												later for most platforms) will use this nameserver.
												Older clients will ignore it.
											</Tooltip.Body>
										</Tooltip>
									</div>
									<Dialog.Text className="text-sm">
										This nameserver will only be used for some domains.
									</Dialog.Text>
								</div>
								<Switch
									label="Split DNS"
									defaultSelected={split}
									onChange={() => {
										setSplit(!split);
									}}
								/>
							</div>
							{split ? (
								<>
									<Dialog.Text className="font-semibold mt-8">
										Domain
									</Dialog.Text>
									<TextField
										label="Domain"
										placeholder="example.com"
										name="domain"
										state={[domain, setDomain]}
										className="my-2"
									/>
									<Dialog.Text className="text-sm">
										Only single-label or fully-qualified queries matching this
										suffix should use the nameserver.
									</Dialog.Text>
								</>
							) : undefined}
							<div className="mt-6 flex justify-end gap-2 mt-6">
								<Dialog.Action variant="cancel" onPress={close}>
									Cancel
								</Dialog.Action>
								<Dialog.Action variant="confirm" onPress={close}>
									Add
								</Dialog.Action>
							</div>
						</Form>
					</>
				)}
			</Dialog.Panel>
		</Dialog>
	);
}
