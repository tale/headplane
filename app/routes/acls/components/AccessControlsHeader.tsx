import Link from '~/components/Link';
import Tabs from '~/components/Tabs';

export type AclEditorMode = 'visual' | 'json';

interface AccessControlsHeaderProps {
	mode: AclEditorMode;
	onModeChange: (mode: AclEditorMode) => void;
}

export default function AccessControlsHeader({
	mode,
	onModeChange,
}: AccessControlsHeaderProps) {
	return (
		<div className="flex justify-between items-center mb-6">
			<div className="flex flex-col w-2/3">
				<h1 className="text-2xl font-medium mb-2">Access Control List (ACL)</h1>
				<p>
					Control who and which devices are allowed to connect in your network.{' '}
					<Link
						className="whitespace-nowrap"
						name="Read KB article about Access controls"
						to="https://tailscale.com/kb/1337/policy-syntax"
					>
						Learn more
					</Link>
				</p>
			</div>
			<div className="flex items-center">
				<div className="flex text-nowrap items-center">
					{/* Visual / JSON mode toggle */}
					<Tabs
						aria-label="Access controls editor mode"
						className="w-fit"
						label="Access controls editor mode"
						onSelectionChange={(key) => onModeChange(key as AclEditorMode)}
						selectedKey={mode}
						variant="pill"
					>
						<Tabs.Item
							key="visual"
							title={
								<span className="w-auto text-sm text-center px-3 font-medium">
									Visual editor
								</span>
							}
						>
							{null}
						</Tabs.Item>
						<Tabs.Item
							key="json"
							title={
								<span className="w-auto text-sm text-center px-3 font-medium">
									JSON editor
								</span>
							}
						>
							{null}
						</Tabs.Item>
					</Tabs>
				</div>
			</div>
		</div>
	);
}
