import Code from '~/components/Code';
import Dialog from '~/components/Dialog';
import Input from '~/components/Input';

export default function Add() {
	return (
		<Dialog>
			<Dialog.Button>Add a new user</Dialog.Button>
			<Dialog.Panel>
				<Dialog.Title>Add a new user</Dialog.Title>
				<Dialog.Text className="mb-8">
					Enter a username to create a new user. Usernames can be addressed when
					managing ACL policies.
				</Dialog.Text>
				<input type="hidden" name="_method" value="create" />
				<Input
					isRequired
					name="username"
					label="Username"
					placeholder="my-new-user"
				/>
			</Dialog.Panel>
		</Dialog>
	);
}
