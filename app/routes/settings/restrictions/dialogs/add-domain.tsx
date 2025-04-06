import { useMemo, useState } from 'react';
import Dialog from '~/components/Dialog';
import Input from '~/components/Input';

interface AddDomainProps {
	domains: string[];
	isDisabled?: boolean;
}

export default function AddDomain({ domains, isDisabled }: AddDomainProps) {
	const [domain, setDomain] = useState('');

	const isInvalid = useMemo(() => {
		if (!domain || domain.trim().length === 0) {
			// Empty domain is invalid, but no error shown
			return false;
		}

		if (domains.includes(domain.trim())) {
			return true;
		}

		try {
			// Check if domain is a valid FQDN
			const url = new URL(`http://${domain.trim()}`);
			return url.hostname !== domain.trim();
		} catch (e) {
			// If URL constructor fails, it's not a valid domain
			return true;
		}
	}, [domain, domains]);

	return (
		<Dialog>
			<Dialog.Button isDisabled={isDisabled}>Add domain</Dialog.Button>
			<Dialog.Panel>
				<Dialog.Title>Add domain</Dialog.Title>
				<Dialog.Text className="mb-4">
					Add this domain to a list of allowed email domains that can
					authenticate with Headscale via OIDC.
				</Dialog.Text>
				<input type="hidden" name="action_id" value="add_domain" />
				<Input
					isRequired
					label="Domain"
					description={
						domain.trim().length > 0
							? `Matches users with <user>@${domain.trim()}`
							: 'Enter a domain to match users with their email addresses.'
					}
					placeholder="example.com"
					name="domain"
					onChange={setDomain}
					isInvalid={domain.trim().length === 0 || isInvalid}
				/>
				{isInvalid && (
					<p className="text-red-500 text-sm mt-2">
						The domain you entered is invalid or already exists in the list.
					</p>
				)}
			</Dialog.Panel>
		</Dialog>
	);
}
