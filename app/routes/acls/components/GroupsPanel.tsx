import { Ellipsis, GripVertical } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import Button from '~/components/Button';
import Link from '~/components/Link';
import Menu from '~/components/Menu';
import Tooltip from '~/components/Tooltip';
import cn from '~/utils/cn';

export type GroupEntry = {
	id: string;
	groupName: string;
	members: string;
	note: string;
};

interface UserGroupsPanelProps {
	groups?: GroupEntry[];
	onAddGroup?: () => void;
	onEditGroup?: (group: GroupEntry) => void;
	onDeleteGroup?: (group: GroupEntry) => void;
	onReorderGroups?: (groups: GroupEntry[]) => void;
}

type Autogroup = {
	id: string;
	name: string;
	size: number;
	hasAvatar: boolean;
};

function getAutogroups(): Autogroup[] {
	// Static example data mirroring Tailscale autogroups.
	return [
		{
			id: 'member',
			name: 'autogroup:member',
			size: 1,
			hasAvatar: true,
		},
		{
			id: 'owner',
			name: 'autogroup:owner',
			size: 1,
			hasAvatar: true,
		},
		{
			id: 'admin',
			name: 'autogroup:admin',
			size: 1,
			hasAvatar: true,
		},
		{
			id: 'it-admin',
			name: 'autogroup:it-admin',
			size: 0,
			hasAvatar: false,
		},
		{
			id: 'network-admin',
			name: 'autogroup:network-admin',
			size: 0,
			hasAvatar: false,
		},
		{
			id: 'billing-admin',
			name: 'autogroup:billing-admin',
			size: 0,
			hasAvatar: false,
		},
		{
			id: 'device-admin',
			name: 'autogroup:device-admin',
			size: 0,
			hasAvatar: false,
		},
		{
			id: 'auditor',
			name: 'autogroup:auditor',
			size: 0,
			hasAvatar: false,
		},
	];
}

function UserGroupsPanel({
	groups = [],
	onAddGroup,
	onEditGroup,
	onDeleteGroup,
	onReorderGroups,
}: UserGroupsPanelProps) {
	const [searchQuery, setSearchQuery] = useState('');
	const [dragOverId, setDragOverId] = useState<string | null>(null);
	const [dragSourceId, setDragSourceId] = useState<string | null>(null);
	const [insertIndex, setInsertIndex] = useState<number | null>(null);

	const normalizedQuery = searchQuery.trim().toLowerCase();
	const isSearchActive = normalizedQuery.length > 0;
	const canReorder = Boolean(onReorderGroups) && !isSearchActive;

	const visibleGroups = useMemo(() => {
		if (!isSearchActive) return groups;

		return groups.filter((group) => {
			const text = [group.groupName, group.members, group.note]
				.join(' ')
				.toLowerCase();
			return text.includes(normalizedQuery);
		});
	}, [groups, isSearchActive, normalizedQuery]);

	const hasGroups = groups.length > 0;
	const hasVisibleGroups = visibleGroups.length > 0;

	const handleReorderAtIndex = (fromId: string, insertAt: number) => {
		if (!onReorderGroups) return;

		const fromIndex = groups.findIndex((group) => group.id === fromId);
		if (fromIndex === -1) return;

		let targetIndex = Math.max(0, Math.min(insertAt, groups.length));
		if (fromIndex < targetIndex) {
			targetIndex -= 1;
		}

		if (fromIndex === targetIndex) return;

		const next = [...groups];
		const [moved] = next.splice(fromIndex, 1);
		next.splice(targetIndex, 0, moved);

		onReorderGroups(next);
	};

	const handleReorder = (fromId: string, toId: string) => {
		if (!onReorderGroups || fromId === toId) return;

		const fromIndex = groups.findIndex((group) => group.id === fromId);
		const toIndex = groups.findIndex((group) => group.id === toId);

		if (fromIndex === -1 || toIndex === -1) return;

		const next = [...groups];
		const [moved] = next.splice(fromIndex, 1);
		next.splice(toIndex, 0, moved);

		onReorderGroups(next);
	};

	return (
		<div className="flex flex-col gap-6 mt-4">
			{/* User-defined groups */}
			<div>
				<section className="flex justify-between items-end gap-4">
					<div>
						<h2 className="text-xl font-semibold tracking-tight">
							User-defined groups
						</h2>
						<p className="max-w-2xl mt-2 text-sm text-headplane-500">
							Create and manage user groups to use in access control policies.
							{` `}
							<Link
								className="link whitespace-nowrap"
								name="Read documentation about Groups"
								to="https://tailscale.com/kb/1396/targets#groups"
							>
								Learn more
							</Link>
							.
						</p>
					</div>
					<div className="flex justify-end">
						<Button
							className="h-9 px-3 flex items-center gap-2"
							onPress={onAddGroup}
							variant="heavy"
						>
							<span className="flex-shrink-0">
								<svg
									aria-hidden="true"
									fill="none"
									height="20"
									stroke="currentColor"
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									viewBox="0 0 24 24"
									width="20"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path d="M5 12h14" />
									<path d="M12 5v14" />
								</svg>
							</span>
							<span className="max-w-full">Create group</span>
						</Button>
					</div>
				</section>

				<section className="mt-4">
					<div className="relative w-full max-w-2xl sm:flex-shrink mb-4">
						<div className="relative">
							<div className="focus-within:ring-1 focus-within:ring-headplane-400 flex flex-row rounded-md border border-headplane-200 hover:border-headplane-300 px-3 py-1 pl-2">
								<svg
									aria-hidden="true"
									className="text-headplane-400 mr-2 mt-1 flex-shrink-0"
									fill="none"
									height="20"
									stroke="currentColor"
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									viewBox="0 0 24 24"
									width="20"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path d="m21 21-4.34-4.34" />
									<circle cx="11" cy="11" r="8" />
								</svg>
								<div className="flex flex-row items-center flex-wrap gap-1 self-stretch flex-grow py-px">
									<input
										className="input border-none flex-shrink flex-grow mr-0 pl-0 min-w-0 w-9 focus:outline-none h-6"
										onChange={(event) => {
											setSearchQuery(event.target.value);
										}}
										placeholder="Search by group name, member, or comment."
										type="text"
										value={searchQuery}
									/>
								</div>
							</div>
						</div>
					</div>

					<div className="border rounded-lg mt-6 overflow-x-auto">
						<table className="w-full">
							<thead className="border-b">
								<tr>
									<td className="pl-4 pr-3 py-2 text-sm text-headplane-900 dark:text-white align-middle font-normal">
										Group name
									</td>
									<td className="pl-1 pr-3 py-2 text-sm text-headplane-900 dark:text-white align-middle font-normal">
										Group members
									</td>
									<td className="pl-1 pr-3 py-2 text-sm text-headplane-900 dark:text-white align-middle font-normal">
										<span className="sr-only">Comment</span>
									</td>
									<td className="pl-1 pr-3 py-2 text-sm text-headplane-900 dark:text-white align-middle min-w-[4%] font-normal">
										<span className="sr-only">Groups action menu</span>
									</td>
									<td className="pl-1 pr-3 py-2 text-sm text-headplane-900 dark:text-white align-middle min-w-[3%] font-normal">
										<span className="sr-only">Reorder group</span>
									</td>
								</tr>
							</thead>
							<tbody className="border-b last:border-0 isolate">
								{!hasGroups ? (
									<tr>
										<td
											className="py-6 text-center text-sm text-gray-400"
											colSpan={5}
										>
											You have not yet defined any groups.
										</td>
									</tr>
								) : !hasVisibleGroups ? (
									<tr>
										<td
											className="py-6 text-center text-sm text-gray-400"
											colSpan={5}
										>
											No groups match this search.
										</td>
									</tr>
								) : (
									visibleGroups.map((group, index) => {
										const showInsertionBefore = insertIndex === index;

										return (
											<Fragment key={group.id}>
												{showInsertionBefore ? (
													<tr>
														<td className="p-0 align-middle" colSpan={6}>
															<div className="h-0.5 bg-headplane-500" />
														</td>
													</tr>
												) : null}
												<tr
													className={cn(
														'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-t border-headplane-100 dark:border-headplane-800 first:border-t-0',
														dragOverId === group.id &&
															'bg-headplane-50 dark:bg-headplane-900/40 border-t-2 border-headplane-500',
														dragSourceId === group.id &&
															'bg-headplane-50 dark:bg-headplane-900 ring-2 ring-headplane-400',
													)}
													onDragEnter={(event) => {
														if (!canReorder) return;
														event.preventDefault();
														setDragOverId(group.id);
													}}
													onDragLeave={() => {
														if (!canReorder) return;
														setDragOverId((current) =>
															current === group.id ? null : current,
														);
													}}
													onDragOver={(event) => {
														if (!canReorder) return;
														event.preventDefault();
														event.dataTransfer.dropEffect = 'move';

														const rowElement =
															event.currentTarget as HTMLTableRowElement;
														const rect = rowElement.getBoundingClientRect();
														const offsetY = event.clientY - rect.top;
														const middleY = rect.height / 2;
														const nextInsertIndex =
															offsetY < middleY ? index : index + 1;

														setInsertIndex(nextInsertIndex);
														setDragOverId(group.id);
													}}
													onDrop={(event) => {
														if (!canReorder) return;
														event.preventDefault();
														const fromId =
															event.dataTransfer.getData('text/plain');
														setDragOverId(null);
														if (!fromId) return;

														let finalInsertIndex = insertIndex;
														if (finalInsertIndex == null) {
															const fallbackIndex = visibleGroups.findIndex(
																(g) => g.id === group.id,
															);
															if (fallbackIndex === -1) return;
															finalInsertIndex = fallbackIndex;
														}

														handleReorderAtIndex(fromId, finalInsertIndex);
														setInsertIndex(null);
													}}
												>
													<td className="pl-4 pr-3 py-4 h-[3.25rem] align-middle">
														{group.groupName}
													</td>
													<td className="pl-1 pr-3 py-4 h-[3.25rem] align-middle">
														{group.members}
													</td>
													<td className="pl-1 pr-3 py-4 h-[3.25rem] align-middle">
														<span>
															<Tooltip>
																<svg
																	aria-hidden="true"
																	className="w-4 h-4 text-headplane-400"
																	fill="none"
																	height="20"
																	stroke="currentColor"
																	strokeLinecap="round"
																	strokeLinejoin="round"
																	strokeWidth="2"
																	viewBox="0 0 24 24"
																	width="20"
																	xmlns="http://www.w3.org/2000/svg"
																>
																	<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
																	<path d="M14 2v4a2 2 0 0 0 2 2h4" />
																	<path d="M10 9H8" />
																	<path d="M16 13H8" />
																	<path d="M16 17H8" />
																</svg>
																<Tooltip.Body className="right-0 w-max max-w-[400px] whitespace-pre-line">
																	{group.note && group.note.trim().length > 0
																		? group.note
																		: 'No note provided.'}
																</Tooltip.Body>
															</Tooltip>
														</span>
													</td>
													<td
														className="pl-1 pr-3 py-4 h-[3.25rem] align-middle"
														onClick={(event) => {
															event.stopPropagation();
														}}
														onKeyDown={(event) => {
															if (event.key === 'Enter' || event.key === ' ') {
																event.stopPropagation();
															}
														}}
													>
														<div className="flex justify-end ml-auto md:ml-0">
															<Menu placement="bottom end">
																<Menu.IconButton
																	className="py-0.5 w-10 bg-transparent border-transparent border group-hover:border-headplane-200 dark:group-hover:border-headplane-700"
																	label={`Actions for group ${group.groupName}`}
																>
																	<Ellipsis className="h-5" />
																</Menu.IconButton>
																<Menu.Panel
																	onAction={(key) => {
																		if (key === 'edit' && onEditGroup) {
																			onEditGroup(group);
																		}
																		if (key === 'delete' && onDeleteGroup) {
																			onDeleteGroup(group);
																		}
																	}}
																>
																	<Menu.Section>
																		<Menu.Item key="edit">Edit group</Menu.Item>
																		<Menu.Item key="delete" textValue="Delete">
																			<p className="text-red-500 dark:text-red-400">
																				Delete
																			</p>
																		</Menu.Item>
																	</Menu.Section>
																</Menu.Panel>
															</Menu>
														</div>
													</td>
													<td className="pl-1 pr-3 py-4 h-[3.25rem] align-middle">
														{canReorder ? (
															<button
																aria-label="Reorder group"
																className="ml-auto flex items-center justify-center text-headplane-400 hover:text-headplane-600 dark:hover:text-headplane-200 cursor-grab"
																draggable
																onClick={(event) => {
																	event.stopPropagation();
																}}
																onDragEnd={() => {
																	setDragSourceId(null);
																	setDragOverId(null);
																	setInsertIndex(null);
																}}
																onDragOver={(event) => {
																	event.preventDefault();
																	event.dataTransfer.dropEffect = 'move';
																}}
																onDragStart={(event) => {
																	event.stopPropagation();
																	setDragSourceId(group.id);
																	event.dataTransfer.effectAllowed = 'move';
																	event.dataTransfer.setData(
																		'text/plain',
																		group.id,
																	);

																	const button =
																		event.currentTarget as HTMLButtonElement;
																	const row = button.closest('tr');
																	if (row && event.dataTransfer.setDragImage) {
																		const rect = row.getBoundingClientRect();
																		const offsetX = event.clientX - rect.left;
																		const offsetY = event.clientY - rect.top;
																		event.dataTransfer.setDragImage(
																			row,
																			offsetX,
																			offsetY,
																		);
																	}
																}}
																onDrop={(event) => {
																	event.preventDefault();
																	const fromId =
																		event.dataTransfer.getData('text/plain');
																	if (!fromId) return;
																	handleReorder(fromId, group.id);
																}}
																type="button"
															>
																<GripVertical
																	aria-hidden="true"
																	className="w-4 h-4"
																/>
															</button>
														) : null}
													</td>
												</tr>
											</Fragment>
										);
									})
								)}
								{insertIndex === visibleGroups.length ? (
									<tr>
										<td className="p-0 align-middle" colSpan={5}>
											<div className="h-0.5 bg-headplane-500" />
										</td>
									</tr>
								) : null}
							</tbody>
						</table>
					</div>
				</section>
			</div>
		</div>
	);
}

export default function GroupsPanel(props: UserGroupsPanelProps) {
	const autogroups = getAutogroups();

	return (
		<div className="flex flex-col gap-6 mt-4">
			<UserGroupsPanel {...props} />

			{/* Autogroups */}
			<div>
				<section className="flex justify-between items-end">
					<div>
						<h2 className="text-xl font-semibold tracking-tight">Autogroups</h2>
						<p className="max-w-2xl mt-2 text-sm text-headplane-500">
							Tailscale has built-in, dynamically generated groups, called
							Autogroups, that you can use in your access policies. Autogroups
							for users are shown below, but you can{` `}
							<Link
								className="link"
								name="Read documentation about Autogroups"
								to="https://tailscale.com/kb/1337/acl-syntax#autogroups"
							>
								see the full list
							</Link>
							{` `}
							of autogroups in our docs.
						</p>
					</div>
				</section>

				<section>
					<div className="border rounded-lg mt-6 overflow-x-auto">
						<table className="w-full">
							<thead className="border-b">
								<tr>
									<td className="pl-4 pr-3 py-2 text-sm text-headplane-900 dark:text-white align-middle font-normal">
										Group name
									</td>
									<td className="pl-1 pr-3 py-2 text-sm text-headplane-900 dark:text-white align-middle font-normal">
										Group size
									</td>
									<td className="pl-1 pr-3 py-2 text-sm text-headplane-900 dark:text-white align-middle font-normal">
										Members
									</td>
									<td className="pl-1 pr-3 py-2 text-sm text-headplane-500 align-middle font-normal">
										<span className="sr-only">Comment</span>
									</td>
									<td className="pl-1 pr-3 py-2 text-sm text-headplane-900 dark:text-white align-middle min-w-[4%] font-normal">
										<span className="sr-only">Autogroups action menu</span>
									</td>
								</tr>
							</thead>
							<tbody className="border-b last:border-0">
								{autogroups.map((group) => (
									<tr
										className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-t border-headplane-100 dark:border-headplane-800 first:border-t-0"
										key={group.id}
									>
										<td className="pl-4 pr-3 py-4 h-[3.25rem] align-middle">
											{group.name}
										</td>
										<td className="pl-1 pr-3 py-4 h-[3.25rem] align-middle">
											{group.size}
										</td>
										<td className="pl-1 pr-3 py-4 h-[3.25rem] align-middle">
											{group.hasAvatar ? (
												<div className="flex items-center">
													<div className="w-7 h-7 rounded-full bg-headplane-200" />
												</div>
											) : null}
										</td>
										<td className="pl-1 pr-3 py-4 h-[3.25rem] align-middle" />
										<td className="pl-1 pr-3 py-4 h-[3.25rem] align-middle" />
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>
			</div>
		</div>
	);
}
