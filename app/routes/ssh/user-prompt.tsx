import { useState } from 'react';
import Button from '~/components/Button';
import Card from '~/components/Card';
import Code from '~/components/Code';
import Input from '~/components/Input';

interface UserPromptProps {
	hostname: string;
}

export default function UserPrompt({ hostname }: UserPromptProps) {
	const [username, setUsername] = useState('');

	return (
		<div className="flex items-center justify-center h-screen">
			<Card>
				<Card.Title>Enter Username</Card.Title>
				<Card.Text className="mb-4">
					Enter the username you want to use to connect to{' '}
					<Code>{hostname}</Code>
					{'. '}
					WebSSH follows the Headscale ACLs, so only permitted usernames will be
					able to connect.
				</Card.Text>
				<Input
					labelHidden
					type="text"
					label="Username"
					placeholder="Username"
					className="mb-2"
					onChange={setUsername}
				/>
				<Button
					variant="heavy"
					className="w-full"
					onPress={() => {
						// We can't use the navigate hook here as we need to do a
						// full page reload to ensure the SSH connection is established
						window.location.href = `${__PREFIX__}/ssh?hostname=${hostname}&username=${username}`;
					}}
				>
					Connect
				</Button>
			</Card>
		</div>
	);
}
