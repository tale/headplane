/* eslint-disable unicorn/no-keyword-prefix */
import {
	closestCorners,
	DndContext,
	DragOverlay
} from '@dnd-kit/core'
import {
	restrictToParentElement,
	restrictToVerticalAxis
} from '@dnd-kit/modifiers'
import {
	arrayMove,
	SortableContext,
	useSortable,
	verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Bars3Icon, LockClosedIcon } from '@heroicons/react/24/outline'
import { useFetcher } from '@remix-run/react'
import clsx from 'clsx'
import { useEffect, useState } from 'react'

import Button from '~/components/Button'
import Input from '~/components/Input'
import TableList from '~/components/TableList'

type Properties = {
	readonly baseDomain?: string;
	readonly searchDomains: string[];
	// eslint-disable-next-line react/boolean-prop-naming
	readonly disabled?: boolean;
}

export default function Domains({ baseDomain, searchDomains, disabled }: Properties) {
	// eslint-disable-next-line unicorn/no-null, @typescript-eslint/ban-types
	const [activeId, setActiveId] = useState<number | string | null>(null)
	const [localDomains, setLocalDomains] = useState(searchDomains)
	const [newDomain, setNewDomain] = useState('')
	const fetcher = useFetcher()

	useEffect(() => {
		setLocalDomains(searchDomains)
	}, [searchDomains])

	return (
		<div className='flex flex-col w-2/3'>
			<h1 className='text-2xl font-medium mb-4'>Search Domains</h1>
			<p className='text-gray-700 dark:text-gray-300 mb-2'>
				Set custom DNS search domains for your Tailnet.
				When using Magic DNS, your tailnet domain is used as the first search domain.
			</p>
			<DndContext
				modifiers={[restrictToVerticalAxis, restrictToParentElement]}
				collisionDetection={closestCorners}
				onDragStart={event => {
					setActiveId(event.active.id)
				}}
				onDragEnd={event => {
					// eslint-disable-next-line unicorn/no-null
					setActiveId(null)
					const { active, over } = event
					if (!over) {
						return
					}

					const activeItem = localDomains[active.id as number - 1]
					const overItem = localDomains[over.id as number - 1]

					if (!activeItem || !overItem) {
						return
					}

					const oldIndex = localDomains.indexOf(activeItem)
					const newIndex = localDomains.indexOf(overItem)

					if (oldIndex !== newIndex) {
						setLocalDomains(arrayMove(localDomains, oldIndex, newIndex))
					}
				}}
			>
				<TableList>
					{baseDomain ? (
						<TableList.Item key='magic-dns-sd'>
							<p className='font-mono text-sm'>{baseDomain}</p>
							<LockClosedIcon className='h-4 w-4'/>
						</TableList.Item>
					) : undefined}
					<SortableContext
						items={localDomains}
						strategy={verticalListSortingStrategy}
					>
						{localDomains.map((sd, index) => (
							<Domain
								// eslint-disable-next-line react/no-array-index-key
								key={index}
								domain={sd}
								id={index + 1}
								localDomains={localDomains}
								disabled={disabled}
							/>
						))}
						<DragOverlay adjustScale>
							{activeId ? <Domain
								isDrag
								domain={localDomains[activeId as number - 1]}
								localDomains={localDomains}
								id={activeId as number - 1}
								disabled={disabled}
							/> : undefined}
						</DragOverlay>
					</SortableContext>
					{disabled ? undefined : (
						<TableList.Item key='add-sd'>
							<Input
								variant='embedded'
								type='text'
								className='font-mono text-sm'
								placeholder='Search Domain'
								value={newDomain}
								onChange={event => {
									setNewDomain(event.target.value)
								}}
							/>
							<Button
								className='text-sm'
								disabled={newDomain.length === 0}
								onClick={() => {
									fetcher.submit({
										// eslint-disable-next-line @typescript-eslint/naming-convention
										'dns_config.domains': [...localDomains, newDomain]
									}, {
										method: 'PATCH',
										encType: 'application/json'
									})

									setNewDomain('')
								}}
							>
								Add
							</Button>
						</TableList.Item>
					)}
				</TableList>
			</DndContext>
		</div>
	)
}

type DomainProperties = {
	readonly domain: string;
	readonly id: number;
	readonly isDrag?: boolean;
	readonly localDomains: string[];
	// eslint-disable-next-line react/boolean-prop-naming
	readonly disabled?: boolean;
}

function Domain({ domain, id, localDomains, isDrag, disabled }: DomainProperties) {
	const fetcher = useFetcher()

	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging
	} = useSortable({ id })

	return (
		<div
			ref={setNodeRef}
			className={clsx(
				'flex items-center justify-between px-3 py-2',
				'border-b border-gray-200 last:border-b-0',
				isDragging ? 'text-gray-400' : 'bg-gray-50',
				isDrag ? 'outline outline-1 outline-gray-500' : undefined
			)}
			style={{
				transform: CSS.Transform.toString(transform),
				transition
			}}
		>
			<p className='font-mono text-sm flex items-center gap-4'>
				{disabled ? undefined : (
					<Bars3Icon
						className='h-4 w-4 text-gray-400 focus:outline-none'
						{...attributes}
						{...listeners}
					/>
				)}
				{domain}
			</p>
			{isDrag ? undefined : (
				<Button
					variant='destructive'
					className='text-sm'
					disabled={disabled}
					onClick={() => {
						fetcher.submit({
						// eslint-disable-next-line @typescript-eslint/naming-convention
							'dns_config.domains': localDomains.filter((_, index) => index !== id - 1)
						}, {
							method: 'PATCH',
							encType: 'application/json'
						})
					}}
				>
					Remove
				</Button>
			)}
		</div>
	)
}
