import { Construction, Eye, FlaskConical, Pencil } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
	ActionFunctionArgs,
	LoaderFunctionArgs,
	useFetcher,
	useLoaderData,
	useRevalidator,
} from 'react-router';
import Button from '~/components/Button';
import Code from '~/components/Code';
import Link from '~/components/Link';
import Notice from '~/components/Notice';
import Tabs from '~/components/Tabs';
import type { LoadContext } from '~/server';
import toast from '~/utils/toast';
import { aclAction } from './acl-action';
import { aclLoader } from './acl-loader';
import { Differ, Editor } from './components/cm.client';

export async function loader(request: LoaderFunctionArgs<LoadContext>) {
	return aclLoader(request);
}

export async function action(request: ActionFunctionArgs<LoadContext>) {
	return aclAction(request);
}

export default function Page() {
	// Access is a write check here, we already check read in aclLoader
	const { access, writable, policy } = useLoaderData<typeof loader>();
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
					set <Code>policy.mode</Code> to <Code>database</Code> in your Headscale
					configuration.
				</Notice>
			) : undefined}
			<h1 className="text-2xl font-medium mb-4">Access Control List (ACL)</h1>
			<p className="mb-4 max-w-prose">
				The ACL file is used to define the access control rules for your
				network. You can find more information about the ACL file in the{' '}
				<Link
					to="https://tailscale.com/kb/1018/acls"
					name="Tailscale ACL documentation"
				>
					Tailscale ACL guide
				</Link>{' '}
				and the{' '}
				<Link
					to="https://headscale.net/stable/ref/acls/"
					name="Headscale ACL documentation"
				>
					Headscale docs
				</Link>
				.
			</p>
			{fetcher.data?.error !== undefined ? (
				<Notice
					variant="error"
					title={fetcher.data.error.split(':')[0] ?? 'Error'}
				>
					{fetcher.data.error.split(':').slice(1).join(': ') ??
						'An unknown error occurred while trying to update the ACL policy.'}
				</Notice>
			) : undefined}
			<Tabs label="ACL Editor" className="mb-4">
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
						value={codePolicy}
						onChange={setCodePolicy}
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
				variant="heavy"
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
