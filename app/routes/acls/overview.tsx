import { Construction, Eye, FlaskConical, Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFetcher, useRevalidator } from 'react-router';
import Button from '~/components/Button';
import Code from '~/components/Code';
import Link from '~/components/Link';
import Notice from '~/components/Notice';
import Tabs from '~/components/Tabs';
import toast from '~/utils/toast';
import type { Route } from './+types/overview';
import { aclAction } from './acl-action';
import { aclLoader } from './acl-loader';
import { Differ, Editor } from './components/cm.client';

export const loader = aclLoader;
export const action = aclAction;

export default function Page({
	loaderData: { access, writable, policy },
}: Route.ComponentProps) {
	const [codePolicy, setCodePolicy] = useState(policy);
	const fetcher = useFetcher<typeof action>();
	const { revalidate } = useRevalidator();
	const disabled = !access || !writable; // Disable if no permission or not writable

	useEffect(() => {
		// Update the codePolicy when the loader data changes
		if (policy !== codePolicy) {
			setCodePolicy(policy);
		}
	}, [policy]);

	useEffect(() => {
		if (!fetcher.data) {
			// No data yet, return
			return;
		}

		if (fetcher.data.success === true) {
			toast('Updated policy');
			revalidate();
		}
	}, [fetcher.data]);

	return (
		<div>
			{!access ? (
				<Notice title="ACL Policy restricted" variant="warning">
					You do not have the necessary permissions to edit the Access Control
					List policy. Please contact your administrator to request access or to
					make changes to the ACL policy.
				</Notice>
			) : !writable ? (
				<Notice title="Read-only ACL Policy" variant="error">
					The ACL policy mode is most likely set to <Code>file</Code> in your
					Headscale configuration. This means that the ACL file cannot be edited
					through the web interface. In order to resolve this, you'll need to
					set <Code>policy.mode</Code> to <Code>database</Code> in your
					Headscale configuration.
				</Notice>
			) : undefined}
			<h1 className="text-2xl font-medium mb-4">Access Control List (ACL)</h1>
			<p className="mb-4 max-w-prose">
				The ACL file is used to define the access control rules for your
				network. You can find more information about the ACL file in the{' '}
				<Link
					name="Tailscale ACL documentation"
					to="https://tailscale.com/kb/1018/acls"
				>
					Tailscale ACL guide
				</Link>{' '}
				and the{' '}
				<Link
					name="Headscale ACL documentation"
					to="https://headscale.net/stable/ref/acls/"
				>
					Headscale docs
				</Link>
				.
			</p>
			{fetcher.data?.error !== undefined ? (
				<Notice
					title={fetcher.data.error.split(':')[0] ?? 'Error'}
					variant="error"
				>
					{fetcher.data.error.split(':').slice(1).join(': ') ??
						'An unknown error occurred while trying to update the ACL policy.'}
				</Notice>
			) : undefined}
			<Tabs className="mb-4" label="ACL Editor">
				<Tabs.Item
					key="edit"
					title={
						<div className="flex items-center gap-2">
							<Pencil className="p-1" />
							<span>Edit file</span>
						</div>
					}
				>
					<Editor
						isDisabled={disabled}
						onChange={setCodePolicy}
						value={codePolicy}
					/>
				</Tabs.Item>
				<Tabs.Item
					key="diff"
					title={
						<div className="flex items-center gap-2">
							<Eye className="p-1" />
							<span>Preview changes</span>
						</div>
					}
				>
					<Differ left={policy} right={codePolicy} />
				</Tabs.Item>
				<Tabs.Item
					key="preview"
					title={
						<div className="flex items-center gap-2">
							<FlaskConical className="p-1" />
							<span>Preview rules</span>
						</div>
					}
				>
					<div className="flex flex-col items-center py-8">
						<Construction />
						<p className="w-1/2 text-center mt-4">
							Previewing rules is not available yet. This feature is still in
							development and is pretty complicated to implement. Hopefully I
							will be able to get to it soon.
						</p>
					</div>
				</Tabs.Item>
			</Tabs>
			<Button
				className="mr-2"
				isDisabled={
					disabled ||
					fetcher.state !== 'idle' ||
					codePolicy.length === 0 ||
					codePolicy === policy
				}
				onPress={() => {
					const formData = new FormData();
					formData.append('policy', codePolicy);
					fetcher.submit(formData, { method: 'PATCH' });
				}}
				variant="heavy"
			>
				Save
			</Button>
			<Button
				isDisabled={
					disabled || fetcher.state !== 'idle' || codePolicy === policy
				}
				onPress={() => {
					// Reset the editor to the original policy
					setCodePolicy(policy);
				}}
			>
				Discard Changes
			</Button>
		</div>
	);
}
