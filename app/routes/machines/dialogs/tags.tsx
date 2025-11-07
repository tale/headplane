import { Plus, TagsIcon, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import Button from '~/components/Button';
import Dialog from '~/components/Dialog';
import Link from '~/components/Link';
import Select from '~/components/Select';
import TableList from '~/components/TableList';
import type { Machine } from '~/types';
import cn from '~/utils/cn';

interface TagsProps {
	machine: Machine;
	isOpen: boolean;
	setIsOpen: (isOpen: boolean) => void;
	nodeList?: Machine[];
}

export default function Tags({
	machine,
	isOpen,
	setIsOpen,
	nodeList,
}: TagsProps) {
	const [tags, setTags] = useState(machine.forcedTags);
	const [tag, setTag] = useState('tag:');
	const tagIsInvalid = useMemo(() => {
		return tag.length === 0 || !tag.startsWith('tag:') || tags.includes(tag);
	}, [tag, tags]);

	const validNodeTags = useMemo(() => {
		if (!nodeList?.length) return [];
		const allNodeTags = Array.from(
			new Set(
				nodeList.flatMap((node) => [...node.validTags, ...node.forcedTags]),
			),
		).sort();
		return allNodeTags.filter((nodeTag) => !tags.includes(nodeTag));
	}, [tags]);

	return (
		<Dialog isOpen={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Panel>
				<Dialog.Title>Edit ACL tags for {machine.givenName}</Dialog.Title>
				<Dialog.Text>
					ACL tags can be used to reference machines in your ACL policies. See
					the{' '}
					<Link
						name="Tailscale documentation"
						to="https://tailscale.com/kb/1068/acl-tags"
					>
						Tailscale documentation
					</Link>{' '}
					for more information.
				</Dialog.Text>
				<input name="action_id" type="hidden" value="update_tags" />
				<input name="node_id" type="hidden" value={machine.id} />
				<input name="tags" type="hidden" value={tags.join(',')} />
				<TableList className="mt-4">
					{tags.length === 0 ? (
						<TableList.Item className="flex flex-col items-center gap-2.5 py-4 opacity-70">
							<TagsIcon />
							<p className="font-semibold">No tags are set on this machine</p>
						</TableList.Item>
					) : (
						tags.map((item) => (
							<TableList.Item className="font-mono" id={item} key={item}>
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
				</TableList>

				<div className="flex items-center gap-2 mt-2">
					<Select
						allowsCustomValue
						aria-label="Add a tag"
						className="w-full"
						inputValue={tag}
						isInvalid={tag.length > 0 && tagIsInvalid}
						onInputChange={setTag}
						placeholder="tag:example"
					>
						{validNodeTags.map((nodeTag) => {
							return <Select.Item key={nodeTag}>{nodeTag}</Select.Item>;
						})}
					</Select>
					<Button
						className={cn(
							'rounded-md p-1',
							tagIsInvalid && 'opacity-50 cursor-not-allowed',
						)}
						isDisabled={tagIsInvalid}
						onPress={() => {
							setTags([...tags, tag]);
							setTag('tag:');
						}}
					>
						<Plus className="p-1" size={30} />
					</Button>
				</div>
			</Dialog.Panel>
		</Dialog>
	);
}
