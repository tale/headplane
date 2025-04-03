import Dialog from '~/components/Dialog';
import Input from '~/components/Input';

interface CreateUserProps {
	isDisabled?: boolean;
}

// TODO: Support image upload for user avatars
export default function CreateUser({ isDisabled }: CreateUserProps) {
	return (
		<Dialog>
			<Dialog.Button isDisabled={isDisabled}>Add a new user</Dialog.Button>
			<Dialog.Panel>
				<Dialog.Title>Add a new user</Dialog.Title>
				<Dialog.Text className="mb-6">
					Enter a username to create a new user. Usernames can be addressed when
					managing ACL policies.
				</Dialog.Text>
				<input type="hidden" name="action_id" value="create_user" />
				<div className="flex flex-col gap-4">
					<Input
						isRequired
						name="username"
						label="Username"
						placeholder="my-new-user"
					/>
					<Input
						name="display_name"
						label="Display Name"
						placeholder="John Doe"
					/>
					<Input name="email" label="Email" placeholder="name@example.com" />
				</div>
			</Dialog.Panel>
		</Dialog>
	);
}
