import { Form, useSubmit } from '@remix-run/react'
import { useState } from 'react'

import Code from '~/components/Code'
import Dialog from '~/components/Dialog'
import TextField from '~/components/TextField'

interface Props {
	magic?: string
}

export default function Add({ magic }: Props) {
	const [username, setUsername] = useState('')
	const submit = useSubmit()

	return (
		<Dialog>
			<Dialog.Button>
				Add a new user
			</Dialog.Button>

			<Dialog.Panel>
				{close => (
					<>
						<Dialog.Title>
							Add a new user
						</Dialog.Title>
						<Dialog.Text className="mb-8">
							Enter a username to create a new user.
							{' '}
							{magic
								? (
									<>
										Since Magic DNS is enabled, machines will be
										accessible via
										{' '}
										<Code>
											[machine].
											{username.length > 0 ? username : '[username]'}
											.
											{magic}
										</Code>
										.
									</>
									)
								: undefined}
						</Dialog.Text>
						<Form
							method="POST"
							onSubmit={(event) => {
								submit(event.currentTarget)
							}}
						>
							<input type="hidden" name="_method" value="create" />
							<TextField
								label="Username"
								placeholder="my-new-user"
								name="username"
								state={[username, setUsername]}
								className="my-2"
							/>
							<div className="mt-6 flex justify-end gap-2 mt-6">
								<Dialog.Action
									variant="cancel"
									onPress={close}
								>
									Cancel
								</Dialog.Action>
								<Dialog.Action
									variant="confirm"
									onPress={close}
								>
									Create
								</Dialog.Action>
							</div>
						</Form>
					</>
				)}
			</Dialog.Panel>
		</Dialog>
	)
}
