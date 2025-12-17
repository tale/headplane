import { Ellipsis, GripVertical } from 'lucide-react';
import { Fragment, useState } from 'react';
import Button from '~/components/Button';
import Menu from '~/components/Menu';
import Tooltip from '~/components/Tooltip';
import cn from '~/utils/cn';

export type GeneralAccessRule = {
	id: string;
	source: string;
	destination: string;
	// Human-friendly summary used in the table, e.g. "tcp 80,443"
	portAndProtocol: string;
	// Raw protocol value from the ACL JSON (proto field), e.g. "tcp"
	protocol: string;
	note: string;
};

interface GeneralAccessRulesPanelProps {
	rules: GeneralAccessRule[];
	onEditRule?: (rule: GeneralAccessRule) => void;
	onDeleteRule?: (rule: GeneralAccessRule) => void;
	onAddRule?: () => void;
	onReorderRules?: (rules: GeneralAccessRule[]) => void;
}

export default function GeneralAccessRulesPanel({
	rules,
	onEditRule,
	onDeleteRule,
	onAddRule,
	onReorderRules,
}: GeneralAccessRulesPanelProps) {
	const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
	const [dragOverRuleId, setDragOverRuleId] = useState<string | null>(null);
	const [dragSourceRuleId, setDragSourceRuleId] = useState<string | null>(null);
	const [insertIndex, setInsertIndex] = useState<number | null>(null);
	const [searchQuery, setSearchQuery] = useState('');

	const handleReorderAtIndex = (fromId: string, insertAt: number) => {
		if (!onReorderRules) return;

		const fromIndex = rules.findIndex((rule) => rule.id === fromId);
		if (fromIndex === -1) return;

		let targetIndex = Math.max(0, Math.min(insertAt, rules.length));
		if (fromIndex < targetIndex) {
			targetIndex -= 1;
		}

		if (fromIndex === targetIndex) return;

		const next = [...rules];
		const [moved] = next.splice(fromIndex, 1);
		next.splice(targetIndex, 0, moved);

		onReorderRules(next);
	};

	const handleReorder = (fromId: string, toId: string) => {
		if (!onReorderRules || fromId === toId) return;

		const fromIndex = rules.findIndex((rule) => rule.id === fromId);
		const toIndex = rules.findIndex((rule) => rule.id === toId);

		if (fromIndex === -1 || toIndex === -1) return;

		const next = [...rules];
		const [moved] = next.splice(fromIndex, 1);
		next.splice(toIndex, 0, moved);

		onReorderRules(next);
	};

	const normalizedQuery = searchQuery.trim().toLowerCase();
	const isSearchActive = normalizedQuery.length > 0;

	const visibleRules = isSearchActive
		? rules.filter((rule) => {
				const text = [
					rule.source,
					rule.destination,
					rule.portAndProtocol,
					rule.note,
				]
					.join(' ')
					.toLowerCase();
				return text.includes(normalizedQuery);
			})
		: rules;

	const canReorder = Boolean(onReorderRules) && !isSearchActive;

	return (
		<div className="mt-4">
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
									placeholder="Search by user, group, device, tag, port, IP address...etc."
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
						onPress={onAddRule}
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
						<span className="max-w-full">Add rule</span>
					</Button>
				</div>
			</section>

			<section>
				<div className="border rounded-lg mt-6 overflow-x-auto">
					<table className="w-full">
						<thead className="border-b">
							<tr>
								<td className="pl-11 pr-3 py-2 text-sm text-headplane-900 dark:text-white align-middle font-normal">
									Sources
								</td>
								<td className="pl-1 pr-3 py-2 text-sm text-headplane-900 dark:text-white align-middle font-normal">
									can access destinations
								</td>
								<td className="pl-1 pr-3 py-2 text-sm text-headplane-900 dark:text-white align-middle font-normal">
									on port and protocol
								</td>
								<td className="pl-1 pr-3 py-2 text-sm text-headplane-900 dark:text-white align-middle font-normal">
									<span className="sr-only">Comment</span>
								</td>
								<td className="pl-1 pr-3 py-2 text-sm text-headplane-900 dark:text-white align-middle min-w-[4%] font-normal">
									<span className="sr-only">
										General access rules action menu
									</span>
								</td>
								<td className="pl-1 pr-3 py-2 text-sm text-headplane-900 dark:text-white align-middle min-w-[3%] font-normal">
									<span className="sr-only">Reorder rule</span>
								</td>
							</tr>
						</thead>
						<tbody className="border-b last:border-0 isolate">
							{visibleRules.map((rule, index) => {
								const isExpanded = rule.id === expandedRuleId;
								const showInsertionBefore = insertIndex === index;

								const toArray = (value: string): string[] =>
									value === '—'
										? []
										: value
												.split(',')
												.map((part) => part.trim())
												.filter(Boolean);

								const srcArray = toArray(rule.source);
								const dstArray = toArray(rule.destination);
								const proto = rule.protocol?.trim() ?? '';

								const aclObject: any = {
									src: srcArray,
									dst: dstArray,
								};

								if (proto) {
									aclObject.proto = proto;
								}

								const jsonPreview = JSON.stringify(aclObject, null, 2);

								const noteLines =
									rule.note && rule.note.trim().length > 0
										? rule.note
												.split('\n')
												.map((line) => `// ${line}`)
												.join('\n')
										: '';

								const aclPreview = noteLines
									? `${noteLines}\n${jsonPreview}`
									: jsonPreview;

								return (
									<Fragment key={rule.id}>
										{showInsertionBefore ? (
											<tr>
												<td className="p-0 align-middle" colSpan={6}>
													<div className="h-0.5 bg-headplane-500" />
												</td>
											</tr>
										) : null}
										<tr
											aria-expanded={isExpanded}
											className={cn(
												'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-t border-headplane-100 dark:border-headplane-800 first:border-t-0',
												dragOverRuleId === rule.id &&
													'bg-headplane-50 dark:bg-headplane-900/40 border-t-2 border-headplane-500',
												dragSourceRuleId === rule.id &&
													'bg-headplane-50 dark:bg-headplane-900 ring-2 ring-headplane-400',
											)}
											onClick={() =>
												setExpandedRuleId(isExpanded ? null : rule.id)
											}
											onDragEnter={(event) => {
												if (!canReorder) return;
												event.preventDefault();
												setDragOverRuleId(rule.id);
											}}
											onDragLeave={() => {
												if (!canReorder) return;
												setDragOverRuleId((current) =>
													current === rule.id ? null : current,
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
												setDragOverRuleId(rule.id);
											}}
											onDrop={(event) => {
												if (!canReorder) return;
												event.preventDefault();
												const fromId = event.dataTransfer.getData('text/plain');
												setDragOverRuleId(null);
												if (!fromId) return;

												let finalInsertIndex = insertIndex;
												if (finalInsertIndex == null) {
													const fallbackIndex = rules.findIndex(
														(r) => r.id === rule.id,
													);
													if (fallbackIndex === -1) return;
													finalInsertIndex = fallbackIndex;
												}

												handleReorderAtIndex(fromId, finalInsertIndex);
												setInsertIndex(null);
											}}
										>
											<td className="pl-1 pr-3 py-4 h-[3.25rem] align-middle">
												<div className="flex items-center">
													<svg
														aria-hidden="true"
														className={
															'text-headplane-400 w-4 mr-2 ml-2 transition-transform ' +
															(isExpanded ? 'rotate-90' : '')
														}
														fill="none"
														height="20"
														stroke="currentColor"
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth="3"
														viewBox="0 0 24 24"
														width="20"
														xmlns="http://www.w3.org/2000/svg"
													>
														<path d="m9 18 6-6-6-6" />
													</svg>
													<div className="leading-6">
														<div className="grid grid-col-1">
															<div className="w-full truncate">
																<span>{rule.source}</span>{' '}
																<span className="invisible">
																	<span className="underline decoration-dotted text-headplane-400 cursor-pointer">
																		+0
																	</span>
																</span>
															</div>
														</div>
													</div>
												</div>
											</td>
											<td className="pl-1 pr-3 py-4 h-[3.25rem] align-middle">
												<div className="grid grid-col-1">
													<div className="w-full truncate">
														<span>{rule.destination}</span>{' '}
														<span className="invisible">
															<span className="underline decoration-dotted text-headplane-400 cursor-pointer">
																+0
															</span>
														</span>
													</div>
												</div>
											</td>
											<td className="pl-1 pr-3 py-4 h-[3.25rem] align-middle">
												<div className="grid grid-col-1">
													<div className="w-full truncate">
														<span>{rule.portAndProtocol}</span>{' '}
														<span className="invisible">
															<span className="underline decoration-dotted text-headplane-400 cursor-pointer">
																+0
															</span>
														</span>
													</div>
												</div>
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
															{rule.note && rule.note.trim().length > 0
																? rule.note
																: 'No note provided.'}
														</Tooltip.Body>
													</Tooltip>
												</span>
											</td>
											<td
												className="py-2 pl-1 pr-3 h-[3.25rem] align-middle"
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
															label={`Actions for grant policy ${rule.id}`}
														>
															<Ellipsis className="h-5" />
														</Menu.IconButton>
														<Menu.Panel
															onAction={(key) => {
																if (key === 'edit' && onEditRule) {
																	onEditRule(rule);
																}
																if (key === 'delete' && onDeleteRule) {
																	onDeleteRule(rule);
																}
															}}
														>
															<Menu.Section>
																<Menu.Item key="edit">Edit rule</Menu.Item>
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
														aria-label="Reorder rule"
														className="ml-auto flex items-center justify-center text-headplane-400 hover:text-headplane-600 dark:hover:text-headplane-200 cursor-grab"
														draggable
														onClick={(event) => {
															event.stopPropagation();
														}}
														onDragEnd={() => {
															setDragSourceRuleId(null);
															setDragOverRuleId(null);
															setInsertIndex(null);
														}}
														onDragOver={(event) => {
															event.preventDefault();
															event.dataTransfer.dropEffect = 'move';
														}}
														onDragStart={(event) => {
															event.stopPropagation();
															setDragSourceRuleId(rule.id);
															event.dataTransfer.effectAllowed = 'move';
															event.dataTransfer.setData('text/plain', rule.id);

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
															handleReorder(fromId, rule.id);
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

										{isExpanded ? (
											<tr>
												<td
													className="p-4 align-middle border-t bg-headplane-800 text-white"
													colSpan={6}
												>
													<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
														<div className="gap-1 grid grid-cols-[1fr_3fr] auto-rows-max text-sm">
															<div className="font-semibold mb-1">Source</div>
															<div>{rule.source}</div>
															<div className="font-semibold mb-1">
																Destination
															</div>
															<div>{rule.destination}</div>
															<div className="font-semibold mb-1">
																Port and protocol
															</div>
															<div>{rule.portAndProtocol}</div>
															<div className="font-semibold mb-1">Note</div>
															<div className="whitespace-pre-line">
																{rule.note && rule.note.trim().length > 0
																	? rule.note
																	: 'No note provided.'}
															</div>
														</div>
														<div className="border-l pl-4 ml-4 leading-5 text-xs md:text-sm">
															<pre className="overflow-hidden">
																<code className="whitespace-pre-wrap">
																	{aclPreview}
																</code>
															</pre>
														</div>
													</div>
												</td>
											</tr>
										) : null}
									</Fragment>
								);
							})}
							{insertIndex === visibleRules.length ? (
								<tr>
									<td className="p-0 align-middle" colSpan={6}>
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
