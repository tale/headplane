import {
	AlertCircle,
	Construction,
	Eye,
	FlaskConical,
	Pencil,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { isRouteErrorResponse, useFetcher, useRevalidator } from 'react-router';
import Button from '~/components/Button';
import Card from '~/components/Card';
import Code from '~/components/Code';
import Link from '~/components/Link';
import Notice from '~/components/Notice';
import Tabs from '~/components/Tabs';
import { isApiError } from '~/server/headscale/api/error-client';
import toast from '~/utils/toast';
import type { Route } from './+types/overview';
import { aclAction } from './acl-action';
import { aclLoader } from './acl-loader';
import AccessControlsHeader, {
	type AclEditorMode,
} from './components/AccessControlsHeader';
import AccessControlsVisualEditor from './components/AccessControlsVisualEditor';
import { Differ, Editor } from './components/cm.client';

export const loader = aclLoader;
export const action = aclAction;

export default function Page({
	loaderData: { access, writable, policy },
}: Route.ComponentProps) {
	const [mode, setMode] = useState<AclEditorMode>('json');
	const [codePolicy, setCodePolicy] = useState(policy);
	const fetcher = useFetcher<typeof action>();
	const { revalidate } = useRevalidator();
	const disabled = !access || !writable; // Disable if no permission or not writable

	useEffect(() => {
		// Update the codePolicy when the loader data changes
		setCodePolicy(policy);
	}, [policy]);

	useEffect(() => {
		if (!fetcher.data) {
			// No data yet, return
			return;
		}

		if (fetcher.data.success === true) {
			toast('Updated policy');
			revalidate();
			return;
		}

		if (fetcher.data.success === false && fetcher.data.error) {
			// Show a popup instead of letting the user hit a 500 error page.
			// The error string comes directly from the ACL action.
			toast(
				<div data-variant="error">
					<p className="font-semibold">Failed to update ACL policy</p>
					<p className="text-sm">{fetcher.data.error}</p>
				</div>,
				8000,
			);
		}
	}, [fetcher.data, revalidate]);

	return (
		<div className="pb-20 md:pb-24">
			<AccessControlsHeader mode={mode} onModeChange={setMode} />

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

			{fetcher.data?.error !== undefined ? (
				<Notice
					fullWidth
					title={fetcher.data.error.split(':')[0] ?? 'Error'}
					variant="error"
				>
					{fetcher.data.error.split(':').slice(1).join(': ') ??
						'An unknown error occurred while trying to update the ACL policy.'}
				</Notice>
			) : undefined}

			{mode === 'visual' ? (
				<AccessControlsVisualEditor
					onChangePolicy={(nextPolicy) => {
						setCodePolicy(nextPolicy);
					}}
					onSavePolicy={(nextPolicy) => {
						if (disabled) return;

						const formData = new FormData();
						formData.append('policy', nextPolicy);
						fetcher.submit(formData, { method: 'PATCH' });
					}}
					policy={codePolicy}
				/>
			) : (
				<>
					<p className="mt-4 mb-4 max-w-prose">
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

					<div className="mt-6">
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
										Previewing rules is not available yet. This feature is still
										in development and is pretty complicated to implement.
										Hopefully I will be able to get to it soon.
									</p>
								</div>
							</Tabs.Item>
						</Tabs>

						<div className="flex items-center space-x-3">
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
					</div>
				</>
			)}
		</div>
	);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	if (
		isRouteErrorResponse(error) &&
		isApiError(error.data) &&
		error.data.rawData.includes('reading policy from path') &&
		error.data.rawData.includes('no such file or directory')
	) {
		return (
			<div className="flex flex-col gap-4">
				<Card className="max-w-2xl" variant="flat">
					<div className="flex items-center justify-between gap-4">
						<Card.Title>ACL Policy Unavailable</Card.Title>
						<AlertCircle className="w-6 h-6 mb-2 text-red-500" />
					</div>
					<Card.Text>
						The ACL policy is currently unavailable because the policy file does
						not exist on the server. This usually indicates that Headscale is
						running in <Code>file</Code> mode for ACLs, and the specified policy
						file is missing.
					</Card.Text>
				</Card>
				<Card className="max-w-2xl" variant="flat">
					<Card.Text>
						In order to resolve this issue, there are two possible actions you
						can take:
					</Card.Text>
					<ul className="list-disc list-outside mt-2 ml-4 space-y-1 text-sm">
						<li>
							Create the ACL policy file at the specified path in your Headscale
							configuration.
						</li>
						<li>
							Alternatively, you can switch Headscale to use{' '}
							<Code>database</Code> mode for ACLs by updating your Headscale
							configuration. This will allow Headplane to manage the ACL policy
							directly through the web interface.
						</li>
					</ul>
				</Card>
			</div>
		);
	}

	throw error;
}
