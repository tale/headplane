/* eslint-disable unicorn/no-keyword-prefix */
import {
	closestCenter,
	DndContext,
	DragOverlay,
	PointerSensor,
	TouchSensor,
	useSensor,
	useSensors
} from '@dnd-kit/core'
import {
	arrayMove,
	SortableContext,
	useSortable,
	verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Bars3Icon } from '@heroicons/react/24/outline'
import { useFetcher, useRevalidator } from '@remix-run/react'
import clsx from 'clsx'
import { useState } from 'react'

type Properties = {
	readonly baseDomain?: string;
	readonly searchDomains: string[];
}

export default function Domains({ baseDomain, searchDomains }: Properties) {
	// eslint-disable-next-line unicorn/no-null, @typescript-eslint/ban-types
	const [activeId, setActiveId] = useState<number | string | null>(null)
	const [localDomains, setLocalDomains] = useState(searchDomains)
	const [newDomain, setNewDomain] = useState('')
	const fetcher = useFetcher({ key: 'search-domains' })
	const revalidator = useRevalidator()

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(TouchSensor)
	)

	return (
		<div className='flex flex-col w-2/3'>
			<h1 className='text-2xl font-medium mb-4'>Search Domains</h1>
			<p className='text-gray-700 dark:text-gray-300 mb-2'>
				Set custom DNS search domains for your Tailnet.
				When using Magic DNS, your tailnet domain is used as the first search domain.
			</p>
			<div className='border border-gray-200 rounded-lg bg-gray-50 overflow-clip'>
				{baseDomain ? (
					<div
						key='magic-dns-sd'
						className={clsx(
							'flex items-center justify-between px-3 py-2',
							'border-b border-gray-200 last:border-b-0'
						)}
					>
						<p className='font-mono text-sm'>{baseDomain}</p>
					</div>
				) : undefined}
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
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
					<SortableContext
						items={localDomains}
						strategy={verticalListSortingStrategy}
					>
						{localDomains.map((sd, index) => (
							// eslint-disable-next-line react/no-array-index-key
							<Domain key={index} domain={sd} id={index + 1} localDomains={localDomains}/>
						))}
					</SortableContext>
					<DragOverlay adjustScale>
						{activeId ? <Domain
							isDrag
							domain={localDomains[activeId as number - 1]}
							localDomains={localDomains}
							id={activeId as number - 1}
						/> : undefined}
					</DragOverlay>
				</DndContext>
				<div
					key='add-sd'
					className={clsx(
						'flex items-center justify-between px-3 py-2',
						'border-b border-gray-200 last:border-b-0',
						'bg-white dark:bg-gray-800'
					)}
				>
					<input
						type='text'
						className='w-full focus:ring-none focus:outline-none font-mono text-sm'
						placeholder='Search Domain'
						value={newDomain}
						onChange={event => {
							setNewDomain(event.target.value)
						}}
					/>
					<button
						type='button'
						className='text-sm text-blue-700'
						onClick={() => {
							fetcher.submit({
								// eslint-disable-next-line @typescript-eslint/naming-convention
								'dns_config.domains': [...localDomains, newDomain]
							}, {
								method: 'PATCH',
								encType: 'application/json'
							})

							setNewDomain('')
							if (revalidator.state === 'idle') {
								revalidator.revalidate()
							}
						}}
					>
						Add
					</button>
				</div>
			</div>
		</div>
	)
}

type DomainProperties = {
	readonly domain: string;
	readonly id: number;
	readonly isDrag?: boolean;
	readonly localDomains: string[];
}

function Domain({ domain, id, localDomains, isDrag }: DomainProperties) {
	const fetcher = useFetcher({ key: 'individual-domain' })
	const revalidator = useRevalidator()

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
				isDrag ? 'outline outline-1 outline-gray-500 rounded-md' : undefined
			)}
			style={{
				transform: CSS.Transform.toString(transform),
				transition
			}}
			{...attributes}
			{...listeners}
		>
			<p className='font-mono text-sm flex items-center gap-4'>
				<Bars3Icon className='h-4 w-4 text-gray-400'/>
				{domain}
			</p>
			{isDrag ? undefined : (
				<button
					type='button'
					className='text-sm text-red-700'
					onClick={() => {
						fetcher.submit({
						// eslint-disable-next-line @typescript-eslint/naming-convention
							'dns_config.domains': localDomains.filter((_, index) => index !== id - 1)
						}, {
							method: 'PATCH',
							encType: 'application/json'
						})

						if (revalidator.state === 'idle') {
							revalidator.revalidate()
						}
					}}
				>
					Remove
				</button>
			)}
		</div>
	)
}
