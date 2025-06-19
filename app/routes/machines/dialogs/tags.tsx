import { Plus, TagsIcon, X } from 'lucide-react';
import { useState } from 'react';
import Button from '~/components/Button';
import Dialog from '~/components/Dialog';
import Input from '~/components/Input';
import Link from '~/components/Link';
import TableList from '~/components/TableList';
import type { Machine } from '~/types';
import cn from '~/utils/cn';

interface TagsProps {
	machine: Machine;
	isOpen: boolean;
	setIsOpen: (isOpen: boolean) => void;
}

export default function Tags({ machine, isOpen, setIsOpen }: TagsProps) {
	const [tags, setTags] = useState(machine.forcedTags);
	const [tag, setTag] = useState('');

	return (
		<Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Panel>
				<Dialog.Title>Edit ACL tags for {machine.givenName}</Dialog.Title>
				<Dialog.Text>
					ACL tags can be used to reference machines in your ACL policies. See
					the{' '}
					<Link
						to="https://tailscale.com/kb/1068/acl-tags"
						name="Tailscale documentation"
					>
						Tailscale documentation
					</Link>{' '}
					for more information.
				</Dialog.Text>
				<input type="hidden" name="action_id" value="update_tags" />
				<input type="hidden" name="node_id" value={machine.id} />
				<input type="hidden" name="tags" value={tags.join(',')} />
				<TableList className="mt-4">
					{tags.length === 0 ? (
						<TableList.Item className="flex flex-col items-center gap-2.5 py-4 opacity-70">
							<TagsIcon />
							<p className="font-semibold">No tags are set on this machine</p>
						</TableList.Item>
					) : (
						tags.map((item) => (
							<TableList.Item className="font-mono" key={item} id={item}>
								{item}
								<Button
									className="rounded-md p-0.5"
									onPress={() => {
										setTags(tags.filter((tag) => tag !== item));
									}}
								>
									<X className="p-1" />
								</Button>
							</TableList.Item>
						))
					)}
					<TableList.Item
						className={cn(
							'rounded-b-xl focus-within:ring-3',
							tag.length > 0 &&
								(!tag.startsWith('tag:') || tags.includes(tag)) &&
								'ring-3 ring-red-500 ring-opacity-50',
						)}
					>
						<Input
							labelHidden
							label="Add a tag"
							placeholder="tag:example"
							onChange={setTag}
							className={cn(
								'border-none font-mono p-0',
								'rounded-none focus:ring-0 w-full',
							)}
						/>
						<Button
							className={cn(
								'rounded-md p-0.5',
								(!tag.startsWith('tag:') || tags.includes(tag)) &&
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
							<Plus className="p-1" />
						</Button>
					</TableList.Item>
				</TableList>
			</Dialog.Panel>
		</Dialog>
	);
}
