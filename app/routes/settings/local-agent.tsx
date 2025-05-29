import { useMemo } from 'react';
import { type LoaderFunctionArgs, useLoaderData } from 'react-router';
import { commitSession, getSession } from '~/utils/sessions.server';
import { queryAgent } from '~/utils/ws-agent';
import AgentManagement from './components/agent/manage';

export async function loader({ request, context }: LoaderFunctionArgs) {
	const { ws, wsAuthKey } = context;
	const session = await getSession(request.headers.get('Cookie'));
	const onboarding = session.get('agent_onboarding') ?? false;

	const nodeKey =
		'nodekey:542dad28354eb8d51e240aada7adf0222ba3ecc74af0bbd56123f03eefdb391b';
	const stats = await queryAgent([nodeKey]);

	return {
		configured: wsAuthKey !== undefined,
		onboarding,
		stats: stats?.[nodeKey],
	};
}

export default function Page() {
	const data = useLoaderData<typeof loader>();

	// Whether we show the onboarding or management UI
	const management = useMemo(() => {
		return data.configured && data.onboarding === false;
	}, [data.configured, data.onboarding]);

	return (
		<div className="flex flex-col gap-8 max-w-(--breakpoint-lg)">
			{management ? (
				<AgentManagement reachable={true} hostInfo={data.stats} />
			) : (
				<div>
					<h1>Local Agent Coming Soon</h1>
				</div>
			)}
		</div>
	);
}
