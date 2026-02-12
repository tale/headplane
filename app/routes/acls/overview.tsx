import { AlertCircle, Eye, Pencil } from 'lucide-react';
import { isRouteErrorResponse } from 'react-router';
import Card from '~/components/Card';
import Code from '~/components/Code';
import Link from '~/components/Link';
import Notice from '~/components/Notice';
import Tabs from '~/components/Tabs';
import { isApiError } from '~/server/headscale/api/error-client';
import type { Route } from './+types/overview';
import { aclAction } from './acl-action';
import { aclLoader } from './acl-loader';
import { ActionButtons } from './components/action-buttons';
import { Differ, Editor } from './components/cm.client';
import { TestResults } from './components/test-results';
import { useACLEditor } from './hooks/use-acl-editor';

export const loader = aclLoader;
export const action = aclAction;

export default function Page({
	loaderData: { access, writable, policy },
}: Route.ComponentProps) {
	const editor = useACLEditor(policy);
	const disabled = !access || !writable;

	return (
		<div>
			{!access && (
				<Notice title="ACL Policy restricted" variant="warning">
					You do not have the necessary permissions to edit the Access Control
					List policy. Please contact your administrator to request access or to
					make changes to the ACL policy.
				</Notice>
			)}

			{access && !writable && (
				<Notice title="Read-only ACL Policy" variant="error">
					The ACL policy mode is most likely set to <Code>file</Code> in your
					Headscale configuration. This means that the ACL file cannot be edited
					through the web interface. In order to resolve this, you'll need to
					set <Code>policy.mode</Code> to <Code>database</Code> in your
					Headscale configuration.
				</Notice>
			)}

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

			{editor.saveError && (
				<Notice
					title={editor.saveError.split(':')[0] ?? 'Error'}
					variant="error"
				>
					<span className="whitespace-pre-line">
						{editor.saveError.split(':').slice(1).join(':').trim() ||
							'An unknown error occurred while trying to update the ACL policy.'}
					</span>
				</Notice>
			)}

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
						onChange={editor.setCodePolicy}
						syntaxError={editor.syntaxError ?? undefined}
						testResults={editor.testResults?.results}
						value={editor.codePolicy}
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
					<Differ left={policy} right={editor.codePolicy} />
				</Tabs.Item>
			</Tabs>

			<ActionButtons
				disabled={disabled}
				hasChanges={editor.hasChanges}
				hasPolicy={editor.codePolicy.length > 0}
				isLoading={editor.isLoading}
				onDiscard={() => editor.setCodePolicy(policy)}
				onRunTests={editor.runTests}
				onSave={editor.save}
			/>

			{editor.testError && (
				<Notice title="Test Error" variant="error">
					<span className="whitespace-pre-line">{editor.testError}</span>
				</Notice>
			)}

			{editor.testResults && (
				<TestResults
					onClose={editor.clearTestResults}
					results={editor.testResults}
				/>
			)}
		</div>
	);
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
	const isPolicyFileMissing =
		isRouteErrorResponse(error) &&
		isApiError(error.data) &&
		error.data.rawData.includes('reading policy from path') &&
		error.data.rawData.includes('no such file or directory');

	if (!isPolicyFileMissing) {
		throw error;
	}

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
					In order to resolve this issue, there are two possible actions you can
					take:
				</Card.Text>
				<ul className="list-disc list-outside mt-2 ml-4 space-y-1 text-sm">
					<li>
						Create the ACL policy file at the specified path in your Headscale
						configuration.
					</li>
					<li>
						Alternatively, you can switch Headscale to use <Code>database</Code>{' '}
						mode for ACLs by updating your Headscale configuration. This will
						allow Headplane to manage the ACL policy directly through the web
						interface.
					</li>
				</ul>
			</Card>
		</div>
	);
}
