import { ArrowRightIcon } from '@primer/octicons-react';
import { Link as RemixLink } from 'react-router';
import Button from '~/components/Button';
import Link from '~/components/Link';
import cn from '~/utils/cn';

export default function AgentSection() {
	return (
		<>
			<div className="flex flex-col w-2/3">
				<h1 className="text-2xl font-medium mb-4">Local Agent</h1>
				<p>
					Headplane provides a local agent that can be installed on a server to
					provide additional features including viewing device information and
					SSH access via the web interface (soon). To learn more about the agent
					visit the{' '}
					<Link
						to="https://github.com/tale/headplane/blob/main/docs/Headplane-Agent.md"
						name="Headplane Agent Documentation"
					>
						Headplane documentation
					</Link>
				</p>
			</div>
			<RemixLink to="/settings/local-agent">
				<div className={cn('text-lg font-medium flex items-center')}>
					Manage Agent
					<ArrowRightIcon className="w-5 h-5 ml-2" />
				</div>
			</RemixLink>
		</>
	);
}
