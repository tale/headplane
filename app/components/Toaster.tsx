import { useToaster } from 'react-hot-toast/headless'

export default function Toaster() {
	const { toasts, handlers } = useToaster()
	const { startPause, endPause, calculateOffset, updateHeight } = handlers

	return (
		<div
			className='fixed bottom-0 right-0 p-4 w-80 h-1/2 overflow-hidden'
			onMouseEnter={startPause}
			onMouseLeave={endPause}
		>
			{toasts.slice(0, 6).map(toast => {
				const offset = calculateOffset(toast, {
					reverseOrder: false,
					gutter: -8
				})

				// eslint-disable-next-line @typescript-eslint/ban-types
				const reference = (element: HTMLDivElement | null) => {
					if (element && typeof toast.height !== 'number') {
						const { height } = element.getBoundingClientRect()
						updateHeight(toast.id, -height)
					}
				}

				return (
					<div
						key={toast.id}
						ref={reference}
						className='fixed bottom-4 right-4 p-4 bg-gray-800 rounded-lg text-white transition-all duration-300'
						{...toast.ariaProps}
						style={{
							transform: `translateY(${offset}px) translateX(${toast.visible ? 0 : 200}%)`
						}}
					>
						{typeof toast.message === 'function' ? (
							toast.message(toast)
						) : (
							toast.message
						)}
					</div>
				)
			})}
		</div>
	)
}
