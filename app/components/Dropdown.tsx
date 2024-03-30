import { Menu, type MenuButtonProps, Transition } from '@headlessui/react'
import clsx from 'clsx'
import { Fragment, type HTMLProps, type ReactNode } from 'react'

type Properties = {
	readonly children: ReactNode;
	readonly button: ReactNode;
	// eslint-disable-next-line unicorn/no-keyword-prefix
	readonly className?: string;
}

function Dropdown(properties: Properties) {
	return (
		<div className={clsx('relative', properties.className)}>
			<Menu>
				<Button className='flex flex-col items-center'>
					{properties.button}
				</Button>
				<Transition
					as={Fragment}
					enter='transition ease-out duration-100'
					enterFrom='transform opacity-0 scale-95'
					enterTo='transform opacity-100 scale-100'
					leave='transition ease-in duration-75'
					leaveFrom='transform opacity-100 scale-100'
					leaveTo='transform opacity-0 scale-95'
				>
					<Menu.Items className={clsx(
						'absolute right-0 w-fit max-w-36 mt-2 rounded-md',
						'text-gray-700 dark:text-gray-300',
						'bg-white dark:bg-zinc-800 text-right',
						'overflow-hidden z-50',
						'border border-gray-200 dark:border-zinc-700',
						'divide-y divide-gray-200 dark:divide-zinc-700'
					)}
					>
						{properties.children}
					</Menu.Items>
				</Transition>
			</Menu>
		</div>
	)
}

function Button(properties: MenuButtonProps<'button'>) {
	return (
		<Menu.Button
			{...properties}
			className={clsx(
				properties.className
			)}
		>
			{properties.children}
		</Menu.Button>
	)
}

type ItemProperties = HTMLProps<HTMLDivElement> & {
	variant?: 'static' | 'normal';
}

function Item(properties: ItemProperties) {
	return (
		<Menu.Item>
			{({ active }) => (
				<div
					{...properties}
					className={clsx(
						'px-4 py-2 w-full text-right',
						'focus:outline-none focus:ring',
						'focus:ring-gray-300 dark:focus:ring-zinc-700',
						properties.className,
						properties.variant !== 'static' && active
							? 'bg-gray-100 dark:bg-zinc-500' : ''
					)}
				>
					{properties.children}
				</div>
			)}
		</Menu.Item>
	)
}

export default Object.assign(Dropdown, { Item })
