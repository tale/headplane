/* eslint-disable unicorn/no-keyword-prefix */
import { DndContext, DragOverlay, closestCorners } from '@dnd-kit/core';
import {
	restrictToParentElement,
	restrictToVerticalAxis,
} from '@dnd-kit/modifiers';
import {
	SortableContext,
	arrayMove,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { type FetcherWithComponents, useFetcher } from 'react-router';
import Button from '~/components/Button';
import Input from '~/components/Input';

import Spinner from '~/components/Spinner';
import TableList from '~/components/TableList';
import cn from '~/utils/cn';

type Properties = {
	readonly baseDomain?: string;
	readonly searchDomains: string[];
	readonly disabled?: boolean; // TODO: isDisabled
};

export default function Domains({
	baseDomain,
	searchDomains,
	disabled,
}: Properties) {
	const [activeId, setActiveId] = useState<number | string | null>(null);
	const [localDomains, setLocalDomains] = useState(searchDomains);
	const [newDomain, setNewDomain] = useState('');
	const fetcher = useFetcher();

	useEffect(() => {
		setLocalDomains(searchDomains);
	}, [searchDomains]);

	return (
		<div className="flex flex-col w-2/3">
			<h1 className="text-2xl font-medium mb-4">Search Domains</h1>
			<p className="mb-4">
				Set custom DNS search domains for your Tailnet. When using Magic DNS,
				your tailnet domain is used as the first search domain.
			</p>
			<DndContext
				modifiers={[restrictToVerticalAxis, restrictToParentElement]}
				collisionDetection={closestCorners}
				onDragStart={(event) => {
					setActiveId(event.active.id);
				}}
				onDragEnd={(event) => {
					setActiveId(null);
					const { active, over } = event;
					if (!over) {
						return;
					}

					const activeItem = localDomains[(active.id as number) - 1];
					const overItem = localDomains[(over.id as number) - 1];

					if (!activeItem || !overItem) {
						return;
					}

					const oldIndex = localDomains.indexOf(activeItem);
					const newIndex = localDomains.indexOf(overItem);

					if (oldIndex !== newIndex) {
						setLocalDomains(arrayMove(localDomains, oldIndex, newIndex));
					}
				}}
			>
				<TableList>
					{baseDomain ? (
						<TableList.Item key="magic-dns-sd">
							<div
								className={cn(
									'flex items-center gap-4',
									disabled ? 'flex-row-reverse justify-between w-full' : '',
								)}
							>
								<Lock className="p-0.5" />
								<p className="font-mono text-sm py-0.5">{baseDomain}</p>
							</div>
						</TableList.Item>
					) : undefined}
					<SortableContext
						items={localDomains}
						strategy={verticalListSortingStrategy}
					>
						{localDomains.map((sd, index) => (
							<Domain
								key={sd}
								domain={sd}
								id={index + 1}
								localDomains={localDomains}
								disabled={disabled}
								fetcher={fetcher}
							/>
						))}
						<DragOverlay adjustScale>
							{activeId ? (
								<Domain
									isDrag
									domain={localDomains[(activeId as number) - 1]}
									localDomains={localDomains}
									id={(activeId as number) - 1}
									disabled={disabled}
									fetcher={fetcher}
								/>
							) : undefined}
						</DragOverlay>
					</SortableContext>
					{disabled ? undefined : (
						<TableList.Item key="add-sd">
							<Input
								type="text"
								className={cn(
									'border-none font-mono p-0',
									'rounded-none focus:ring-0 w-full',
								)}
								placeholder="Search Domain"
								onChange={setNewDomain}
								label="Search Domain"
								labelHidden
							/>
							{fetcher.state === 'idle' ? (
								<Button
									className={cn(
										'px-2 py-1 rounded-md',
										'text-blue-500 dark:text-blue-400',
									)}
									isDisabled={newDomain.length === 0}
									onPress={() => {
										fetcher.submit(
											{
												'dns.search_domains': [...localDomains, newDomain],
											},
											{
												method: 'PATCH',
												encType: 'application/json',
											},
										);

										setNewDomain('');
									}}
								>
									Add
								</Button>
							) : (
								<Spinner className="w-3 h-3 mr-0" />
							)}
						</TableList.Item>
					)}
				</TableList>
			</DndContext>
		</div>
	);
}

type DomainProperties = {
	readonly domain: string;
	readonly id: number;
	readonly isDrag?: boolean;
	readonly localDomains: string[];
	readonly disabled?: boolean; // TODO: isDisabled
	readonly fetcher: FetcherWithComponents<unknown>;
};

function Domain({
	domain,
	id,
	localDomains,
	isDrag,
	disabled,
	fetcher,
}: DomainProperties) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id });

	return (
		<TableList.Item
			ref={setNodeRef}
			className={cn(
				isDragging ? 'opacity-50' : '',
				isDrag ? 'ring bg-white dark:bg-headplane-900' : '',
			)}
			style={{
				transform: CSS.Transform.toString(transform),
				transition,
			}}
		>
			<p className="font-mono text-sm flex items-center gap-4">
				{disabled ? undefined : (
					<GripVertical {...attributes} {...listeners} className="p-0.5" />
				)}
				{domain}
			</p>
			{isDrag ? undefined : (
				<Button
					className={cn(
						'px-2 py-1 rounded-md',
						'text-red-500 dark:text-red-400',
					)}
					isDisabled={disabled}
					onPress={() => {
						fetcher.submit(
							{
								'dns.search_domains': localDomains.filter(
									(_, index) => index !== id - 1,
								),
							},
							{
								method: 'PATCH',
								encType: 'application/json',
							},
						);
					}}
				>
					Remove
				</Button>
			)}
		</TableList.Item>
	);
}
