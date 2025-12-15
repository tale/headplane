import { Ellipsis, GripVertical } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import Button from '~/components/Button';
import Link from '~/components/Link';
import Menu from '~/components/Menu';
import Tooltip from '~/components/Tooltip';
import cn from '~/utils/cn';

export type TagOwnerEntry = {
	id: string;
	tagName: string;
	owners: string;
	note: string;
};

interface TagsPanelProps {
	tagOwners: TagOwnerEntry[];
	onAddTagOwner?: () => void;
	onEditTagOwner?: (entry: TagOwnerEntry) => void;
	onDeleteTagOwner?: (entry: TagOwnerEntry) => void;
	onReorderTagOwners?: (entries: TagOwnerEntry[]) => void;
}

export default function TagsPanel({
	tagOwners,
	onAddTagOwner,
	onEditTagOwner,
	onDeleteTagOwner,
	onReorderTagOwners,
}: TagsPanelProps) {
	const [searchQuery, setSearchQuery] = useState('');
	const [dragOverId, setDragOverId] = useState<string | null>(null);
	const [dragSourceId, setDragSourceId] = useState<string | null>(null);
	const [insertIndex, setInsertIndex] = useState<number | null>(null);

	const normalizedQuery = searchQuery.trim().toLowerCase();
	const isSearchActive = normalizedQuery.length > 0;
	const canReorder = Boolean(onReorderTagOwners) && !isSearchActive;

	const visibleTagOwners = useMemo(() => {
		if (!isSearchActive) return tagOwners;

		return tagOwners.filter((entry) => {
			const text = [entry.tagName, entry.owners, entry.note]
				.join(' ')
				.toLowerCase();
			return text.includes(normalizedQuery);
		});
	}, [tagOwners, isSearchActive, normalizedQuery]);

	const hasTagOwners = tagOwners.length > 0;
	const hasVisibleTagOwners = visibleTagOwners.length > 0;

	const handleReorderAtIndex = (fromId: string, insertAt: number) => {
		if (!onReorderTagOwners) return;

		const fromIndex = tagOwners.findIndex((entry) => entry.id === fromId);
		if (fromIndex === -1) return;

		let targetIndex = Math.max(0, Math.min(insertAt, tagOwners.length));
		if (fromIndex < targetIndex) {
			targetIndex -= 1;
		}

		if (fromIndex === targetIndex) return;

		const next = [...tagOwners];
		const [moved] = next.splice(fromIndex, 1);
		next.splice(targetIndex, 0, moved);

		onReorderTagOwners(next);
	};

	const handleReorder = (fromId: string, toId: string) => {
		if (!onReorderTagOwners || fromId === toId) return;

		const fromIndex = tagOwners.findIndex((entry) => entry.id === fromId);
		const toIndex = tagOwners.findIndex((entry) => entry.id === toId);

		if (fromIndex === -1 || toIndex === -1) return;

		const next = [...tagOwners];
		const [moved] = next.splice(fromIndex, 1);
		next.splice(toIndex, 0, moved);

		onReorderTagOwners(next);
	};

	return (
		<div className="mt-4">
			<section className="max-w-2xl">
				<p className="text-sm text-gray-500">
					Organize non-user devices like servers into functional groups to use
					in access control policies.{' '}
					<Link
						className="whitespace-nowrap"
						name="Read documentation about Tag owners"
						to="https://tailscale.com/kb/1337/policy-syntax#tag-owners"
					>
						Learn more
					</Link>
					.
				</p>
			</section>

			<section className="flex flex-col sm:flex-row gap-4 sm:justify-between mt-4">
				<div className="relative w-full max-w-2xl sm:flex-shrink">
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
									placeholder="Search by tag name, owner, or comment."
									type="text"
									value={searchQuery}
								/>
							</div>
						</div>
					</div>
				</div>
				<div className="flex justify-end">
					<Button
						className="h-9 px-3 flex items-center gap-2"
						onPress={onAddTagOwner}
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
						<span className="max-w-full">Create tag</span>
					</Button>
				</div>
			</section>

			<section className="mt-4">
				<div className="border rounded-lg mt-6 overflow-x-auto">
					<table className="w-full">
						<thead className="border-b">
							<tr>
								<td className="pl-4 pr-3 py-2 text-sm text-headplane-900 dark:text-white align-middle font-normal">
									Tag name
								</td>
								<td className="pl-1 pr-3 py-2 text-sm text-headplane-900 dark:text-white align-middle font-normal">
									Tag owners
								</td>
								<td className="pl-1 pr-3 py-2 text-sm text-headplane-900 dark:text-white align-middle font-normal">
									<span className="sr-only">Comment</span>
								</td>
								<td className="pl-1 pr-3 py-2 text-sm text-headplane-900 dark:text-white align-middle min-w-[4%] font-normal">
									<span className="sr-only">Tags action menu</span>
								</td>
								<td className="pl-1 pr-3 py-2 text-sm text-headplane-900 dark:text-white align-middle min-w-[3%] font-normal">
									<span className="sr-only">Reorder tag</span>
								</td>
							</tr>
						</thead>
						<tbody className="border-b last:border-0 isolate">
							{!hasTagOwners ? (
								<tr>
									<td
										className="py-6 text-center text-sm text-gray-400"
										colSpan={5}
									>
										You have not yet defined any tags.
									</td>
								</tr>
							) : !hasVisibleTagOwners ? (
								<tr>
									<td
										className="py-6 text-center text-sm text-gray-400"
										colSpan={5}
									>
										No tags match this search.
									</td>
								</tr>
							) : (
								visibleTagOwners.map((entry, index) => {
									const showInsertionBefore = insertIndex === index;

									return (
										<Fragment key={entry.id}>
											{showInsertionBefore ? (
												<tr>
													<td className="p-0 align-middle" colSpan={5}>
														<div className="h-0.5 bg-headplane-500" />
													</td>
												</tr>
											) : null}
											<tr
												className={cn(
													'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-t border-headplane-100 dark:border-headplane-800 first:border-t-0',
													dragOverId === entry.id &&
														'bg-headplane-50 dark:bg-headplane-900/40 border-t-2 border-headplane-500',
													dragSourceId === entry.id &&
														'bg-headplane-50 dark:bg-headplane-900 ring-2 ring-headplane-400',
												)}
												onDragEnter={(event) => {
													if (!canReorder) return;
													event.preventDefault();
													setDragOverId(entry.id);
												}}
												onDragLeave={() => {
													if (!canReorder) return;
													setDragOverId((current) =>
														current === entry.id ? null : current,
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
													setDragOverId(entry.id);
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
														const fallbackIndex = visibleTagOwners.findIndex(
															(e) => e.id === entry.id,
														);
														if (fallbackIndex === -1) return;
														finalInsertIndex = fallbackIndex;
													}

													handleReorderAtIndex(fromId, finalInsertIndex);
													setInsertIndex(null);
												}}
											>
												<td className="pl-4 pr-3 py-4 h-[3.25rem] align-middle">
													{entry.tagName}
												</td>
												<td className="pl-1 pr-3 py-4 h-[3.25rem] align-middle">
													{entry.owners}
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
																{entry.note && entry.note.trim().length > 0
																	? entry.note
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
																label={`Actions for tag ${entry.tagName}`}
															>
																<Ellipsis className="h-5" />
															</Menu.IconButton>
															<Menu.Panel
																onAction={(key) => {
																	if (key === 'edit' && onEditTagOwner) {
																		onEditTagOwner(entry);
																	}
																	if (key === 'delete' && onDeleteTagOwner) {
																		onDeleteTagOwner(entry);
																	}
																}}
															>
																<Menu.Section>
																	<Menu.Item key="edit">Edit tag</Menu.Item>
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
															aria-label="Reorder tag"
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
																setDragSourceId(entry.id);
																event.dataTransfer.effectAllowed = 'move';
																event.dataTransfer.setData(
																	'text/plain',
																	entry.id,
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
																handleReorder(fromId, entry.id);
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
							{insertIndex === visibleTagOwners.length ? (
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

			<div className="flex justify-between mt-4" />
		</div>
	);
}
