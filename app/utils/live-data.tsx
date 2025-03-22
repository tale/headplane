import { createContext, useContext, useEffect, useState } from 'react';
import { useRevalidator } from 'react-router';
import { useInterval } from 'usehooks-ts';

const LiveDataPausedContext = createContext({
	paused: false,
	setPaused: (_: boolean) => {},
});

interface LiveDataProps {
	children: React.ReactNode;
}

export function LiveDataProvider({ children }: LiveDataProps) {
	const [paused, setPaused] = useState(false);
	const revalidator = useRevalidator();

	// Document is marked as optional here because it's not available in SSR
	// The optional chain means if document is not defined, visible is false
	const [visible, setVisible] = useState(
		() =>
			typeof document !== 'undefined' && document.visibilityState === 'visible',
	);

	// Function to revalidate safely
	const revalidateIfIdle = () => {
		if (revalidator.state === 'idle') {
			revalidator.revalidate();
		}
	};

	useEffect(() => {
		const handleVisibilityChange = () => {
			setVisible(document.visibilityState === 'visible');
			if (!paused && document.visibilityState === 'visible') {
				revalidateIfIdle();
			}
		};

		window.addEventListener('online', revalidateIfIdle);
		document.addEventListener('focus', revalidateIfIdle);
		document.addEventListener('visibilitychange', handleVisibilityChange);

		return () => {
			window.removeEventListener('online', revalidateIfIdle);
			document.removeEventListener('focus', revalidateIfIdle);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	}, [paused, revalidator]);

	// Poll only when visible and not paused
	useInterval(revalidateIfIdle, visible && !paused ? 3000 : null);

	return (
		<LiveDataPausedContext.Provider value={{ paused, setPaused }}>
			{children}
		</LiveDataPausedContext.Provider>
	);
}

export function useLiveData() {
	const context = useContext(LiveDataPausedContext);
	return {
		pause: () => context.setPaused(true),
		resume: () => context.setPaused(false),
	};
}
