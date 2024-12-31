import { PlusIcon, XIcon } from '@primer/octicons-react';
import { Form, useSubmit } from 'react-router';
import { Dispatch, SetStateAction, useState } from 'react';
import { Button, Input } from 'react-aria-components';

import Dialog from '~/components/Dialog';
import Link from '~/components/Link';
import { Machine } from '~/types';
import { cn } from '~/utils/cn';

interface TagsProps {
	readonly machine: Machine;
	readonly state: [boolean, Dispatch<SetStateAction<boolean>>];
}

export default function Tags({ machine, state }: TagsProps) {
	const [tags, setTags] = useState(machine.forcedTags);
	const [tag, setTag] = useState('');
	const submit = useSubmit();

	return (
		<Dialog>
			<Dialog.Panel control={state}>
				{(close) => (
					<>
						<Dialog.Title>Edit ACL tags for {machine.givenName}</Dialog.Title>
						<Dialog.Text>
							ACL tags can be used to reference machines in your ACL policies.
							See the{' '}
							<Link
								to="https://tailscale.com/kb/1068/acl-tags"
								name="Tailscale documentation"
							>
								Tailscale documentation
							</Link>{' '}
							for more information.
						</Dialog.Text>
						<Form
							method="POST"
							onSubmit={(e) => {
								submit(e.currentTarget);
							}}
						>
							<input type="hidden" name="_method" value="tags" />
							<input type="hidden" name="id" value={machine.id} />
							<input type="hidden" name="tags" value={tags.join(',')} />
							<div
								className={cn(
									'border border-ui-300 rounded-lg overflow-visible',
									'dark:border-ui-700 dark:text-ui-300 mt-4',
								)}
							>
								<div className="divide-y divide-ui-200 dark:divide-ui-600">
									{tags.length === 0 ? (
										<div
											className={cn(
												'flex py-4 px-4 bg-ui-100 dark:bg-ui-800',
												'items-center justify-center rounded-t-lg',
												'text-ui-600 dark:text-ui-300',
											)}
										>
											<p>No tags are set on this machine.</p>
										</div>
									) : (
										tags.map((item) => (
											<div
												key={item}
												id={item}
												className={cn(
													'px-2.5 py-1.5 flex',
													'items-center justify-between',
													'font-mono text-sm',
												)}
											>
												{item}
												<Button
													className="rounded-full p-0 w-6 h-6"
													onPress={() => {
														setTags(tags.filter((tag) => tag !== item));
													}}
												>
													<XIcon className="w-4 h-4" />
												</Button>
											</div>
										))
									)}
								</div>
								<div
									className={cn(
										'flex px-2.5 py-1.5 w-full',
										'border-t border-ui-300 dark:border-ui-700',
										'rounded-b-lg justify-between items-center',
										'dark:bg-ui-800 dark:text-ui-300',
										'focus-within:ring-2 focus-within:ring-blue-600',
										tag.length > 0 &&
											!tag.startsWith('tag:') &&
											'outline outline-red-500',
									)}
								>
									<Input
										placeholder="tag:example"
										className={cn(
											'bg-transparent w-full',
											'border-none focus:ring-0',
											'focus:outline-none font-mono text-sm',
											'dark:bg-transparent dark:text-ui-300',
										)}
										value={tag}
										onChange={(e) => {
											setTag(e.currentTarget.value);
										}}
									/>
									<Button
										className={cn(
											'rounded-lg p-0 h-6 w-6',
											!tag.startsWith('tag:') &&
												'opacity-50 cursor-not-allowed',
										)}
										isDisabled={
											tag.length === 0 ||
											!tag.startsWith('tag:') ||
											tags.includes(tag)
										}
										onPress={() => {
											setTags([...tags, tag]);
											setTag('');
										}}
									>
										<PlusIcon className="w-4 h-4" />
									</Button>
								</div>
							</div>
							<div className="mt-6 flex justify-end gap-2 mt-6">
								<Dialog.Action variant="cancel" onPress={close}>
									Cancel
								</Dialog.Action>
								<Dialog.Action variant="confirm" onPress={close}>
									Save
								</Dialog.Action>
							</div>
						</Form>
					</>
				)}
			</Dialog.Panel>
		</Dialog>
	);
}
