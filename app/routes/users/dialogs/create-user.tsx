import Dialog from '~/components/Dialog';
import Input from '~/components/Input';

interface CreateUserProps {
	isOidc?: boolean;
	isDisabled?: boolean;
}

// TODO: Support image upload for user avatars
export default function CreateUser({ isOidc, isDisabled }: CreateUserProps) {
	return (
		<Dialog>
			<Dialog.Button isDisabled={isDisabled}>Add a new user</Dialog.Button>
			<Dialog.Panel>
				<Dialog.Title>Add a new user</Dialog.Title>
				<Dialog.Text className="mb-6">
					Enter a username to create a new user. Usernames can be addressed when
					managing ACL policies.
					{isOidc ? (
						<>
							{' '}
							Manually created users are given administrative access to
							Headplane unless they become linked to an OIDC user in Headscale.
						</>
					) : undefined}
				</Dialog.Text>
				<input name="action_id" type="hidden" value="create_user" />
				<div className="flex flex-col gap-4">
					<Input
						isRequired
						label="Username"
						name="username"
						placeholder="my-new-user"
						type="text"
						validate={(value) => {
							if (value.trim().length === 0) {
								return 'Username is required';
							}

							if (value.includes(' ')) {
								return 'Usernames cannot contain spaces';
							}

							return true;
						}}
						validationBehavior="native"
					/>
					<Input
						label="Display Name"
						name="display_name"
						placeholder="John Doe"
						type="text"
						validationBehavior="native"
					/>
					<Input
						label="Email"
						name="email"
						placeholder="name@example.com"
						type="email"
						validationBehavior="native"
					/>
				</div>
			</Dialog.Panel>
		</Dialog>
	);
}
