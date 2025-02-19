import { Construction, Eye, FlaskConical, Pencil } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { useFetcher, useLoaderData, useRevalidator } from 'react-router';
import Button from '~/components/Button';
import Link from '~/components/Link';
import Notice from '~/components/Notice';
import Spinner from '~/components/Spinner';
import Tabs from '~/components/Tabs';
import { hs_getConfig } from '~/utils/config/loader';
import { HeadscaleError, pull, put } from '~/utils/headscale';
import log from '~/utils/log';
import { send } from '~/utils/res';
import { getSession } from '~/utils/sessions.server';
import toast from '~/utils/toast';
import type { AppContext } from '~server/context/app';
import { Differ, Editor } from './components/cm.client';
import { ErrorView } from './components/error';
import { Unavailable } from './components/unavailable';

export async function loader({ request }: LoaderFunctionArgs<AppContext>) {
	const session = await getSession(request.headers.get('Cookie'));

	// The way policy is handled in 0.23 of Headscale and later is verbose.
	// The 2 ACL policy modes are either the database one or file one
	//
	// File: The ACL policy is readonly to the API and manually edited
	// Database: The ACL policy is read/write to the API
	//
	// To determine if we first have an ACL policy available we need to check
	// if fetching the v1/policy route gives us a 500 status code or a 200.
	//
	// 500 can mean many different things here unfortunately:
	// - In file based that means the file is not accessible
	// - In database mode this can mean that we have never set an ACL policy
	// - In database mode this can mean that the ACL policy is not available
	// - A general server error may have occurred
	//
	// Unfortunately the server errors are not very descriptive so we have to
	// do some silly guesswork here. If we are running in an integration mode
	// and have the Headscale configuration available to us, our assumptions
	// can be more accurate, otherwise we just HAVE to assume that the ACL
	// policy has never been set.
	//
	// We can do damage control by checking for write access and if we are not
	// able to PUT an ACL policy on the v1/policy route, we can already know
	// that the policy is at the very-least readonly or not available.
	const { mode, config } = hs_getConfig();
	let modeGuess = 'database'; // Assume database mode
	if (mode !== 'no') {
		modeGuess = config.policy?.mode ?? 'database';
	}

	// Attempt to load the policy, for both the frontend and for checking
	// if we are able to write to the policy for write access
	try {
		const { policy } = await pull<{ policy: string }>(
			'v1/policy',
			session.get('hsApiKey')!,
		);

		let write = false; // On file mode we already know it's readonly
		if (modeGuess === 'database' && policy.length > 0) {
			try {
				await put('v1/policy', session.get('hsApiKey')!, {
					policy: policy,
				});

				write = true;
			} catch (error) {
				write = false;
				log.debug('APIC', 'Failed to write to ACL policy with error %s', error);
			}
		}

		return {
			read: true,
			write,
			mode: modeGuess,
			policy,
		};
	} catch {
		// If we are explicit on file mode then this is the end of the road
		if (modeGuess === 'file') {
			return {
				read: false,
				write: false,
				mode: modeGuess,
				policy: null,
			};
		}

		// Assume that we have write access otherwise?
		// This is sort of a brittle assumption to make but we don't want
		// to create a default policy if we don't have to.
		return {
			read: true,
			write: true,
			mode: modeGuess,
			policy: null,
		};
	}
}

export async function action({ request }: ActionFunctionArgs) {
	const session = await getSession(request.headers.get('Cookie'));
	if (!session.has('hsApiKey')) {
		return send({ success: false, error: null }, 401);
	}

	try {
		const { acl } = (await request.json()) as { acl: string };
		const { policy } = await put<{ policy: string }>(
			'v1/policy',
			session.get('hsApiKey')!,
			{
				policy: acl,
			},
		);

		return { success: true, policy, error: null };
	} catch (error) {
		log.debug('APIC', 'Failed to update ACL policy with error %s', error);

		// @ts-ignore: TODO: Shut UP we know it's a string most of the time
		const text = JSON.parse(error.message);
		return send(
			{ success: false, error: text.message },
			{
				status: error instanceof HeadscaleError ? error.status : 500,
			},
		);
	}
}

export default function Page() {
	const data = useLoaderData<typeof loader>();
	const fetcher = useFetcher<typeof action>();
	const revalidator = useRevalidator();

	const [acl, setAcl] = useState(data.policy ?? '');
	const [toasted, setToasted] = useState(false);

	useEffect(() => {
		if (!fetcher.data || toasted) {
			return;
		}

		if (fetcher.data.success) {
			toast('Updated tailnet ACL policy');
		} else {
			toast('Failed to update tailnet ACL policy');
		}

		setToasted(true);
		if (revalidator.state === 'idle') {
			revalidator.revalidate();
		}
	}, [fetcher.data, toasted, data.policy]);

	// The state for if the save and discard buttons should be disabled
	// is pretty complicated to calculate and varies on different states.
	const disabled = useMemo(() => {
		if (!data.read || !data.write) {
			return true;
		}

		// First check our fetcher states
		if (fetcher.state === 'loading') {
			return true;
		}

		if (revalidator.state === 'loading') {
			return true;
		}

		// If we have a failed fetcher state allow the user to try again
		if (fetcher.data?.success === false) {
			return false;
		}

		return data.policy === acl;
	}, [data, revalidator.state, fetcher.state, fetcher.data, data.policy, acl]);

	return (
		<div>
			{data.read && !data.write ? (
				<div className="mb-4">
					<Notice>
						The ACL policy is read-only. You can view the current policy but you
						cannot make changes to it.
						<br />
						To resolve this, you need to set the ACL policy mode to database in
						your Headscale configuration.
					</Notice>
				</div>
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
			{fetcher.data?.success === false ? (
				<ErrorView message={fetcher.data.error} />
			) : undefined}
			{data.read ? (
				<>
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
							<Editor isDisabled={!data.write} value={acl} onChange={setAcl} />
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
							<Differ left={data?.policy ?? ''} right={acl} />
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
					<Button
						variant="heavy"
						className="mr-2"
						isDisabled={disabled}
						onPress={() => {
							setToasted(false);
							fetcher.submit(
								{
									acl,
								},
								{
									method: 'PATCH',
									encType: 'application/json',
								},
							);
						}}
					>
						{fetcher.state === 'idle' ? undefined : (
							<Spinner className="w-3 h-3" />
						)}
						Save
					</Button>
					<Button
						isDisabled={disabled}
						onPress={() => {
							setAcl(data?.policy ?? '');
						}}
					>
						Discard Changes
					</Button>
				</>
			) : (
				<Unavailable mode={data.mode as 'database' | 'file'} />
			)}
		</div>
	);
}
