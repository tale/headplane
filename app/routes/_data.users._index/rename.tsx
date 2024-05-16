import { PencilIcon } from '@primer/octicons-react'
import { Form, useSubmit } from '@remix-run/react'
import { useState } from 'react'

import Button from '~/components/Button'
import Code from '~/components/Code'
import Dialog from '~/components/Dialog'
import TextField from '~/components/TextField'

interface Props {
	username: string
	magic?: string
}

export default function Rename({ username, magic }: Props) {
	const submit = useSubmit()
	const dialogState = useState(false)
	const [newName, setNewName] = useState(username)

	return (
		<>
			<Button
				variant="light"
				control={dialogState}
				className="rounded-full p-0 w-8 h-8"
			>
				<PencilIcon className="w-4 h-4" />
			</Button>
			<Dialog control={dialogState}>
				<Dialog.Panel control={dialogState}>
					{close => (
						<>
							<Dialog.Title>
								Rename
								{' '}
								{username}
								?
							</Dialog.Title>
							<Dialog.Text className="mb-8">
								Enter a new username for
								{' '}
								{username}
								?
								{magic
									? (
										<p className="text-sm mt-8 text-ui-600 dark:text-ui-300">
											{' '}
											Since Magic DNS is enabled, machines
											currently accessible via
											{' '}
											<Code>
												[machine].
												{username}
												.
												{magic}
											</Code>
											{' '}
											will now become accessible via
											{' '}
											<Code>
												[machine].
												{newName.length > 0 ? newName : '[new-username]'}
												.
												{magic}
											</Code>
											.
										</p>
										)
									: undefined}
							</Dialog.Text>
							<Form
								method="POST"
								onSubmit={(event) => {
									submit(event.currentTarget)
								}}
							>
								<input type="hidden" name="_method" value="rename" />
								<input type="hidden" name="old" value={username} />
								<TextField
									label="Username"
									placeholder="my-new-name"
									name="new"
									state={[newName, setNewName]}
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
										Rename
									</Dialog.Action>
								</div>
							</Form>
						</>
					)}
				</Dialog.Panel>
			</Dialog>
		</>
	)
}
