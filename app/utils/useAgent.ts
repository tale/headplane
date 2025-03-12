import { useEffect, useMemo, useRef } from 'react';
import { useFetcher } from 'react-router';
import { HostInfo } from '~/types';

export default function useAgent(nodeIds: string[], interval = 3000) {
	const fetcher = useFetcher<Record<string, HostInfo>>();
	const qp = useMemo(
		() => new URLSearchParams({ node_ids: nodeIds.join(',') }),
		[nodeIds],
	);

	const idRef = useRef<string[]>([]);
	useEffect(() => {
		if (idRef.current.join(',') !== nodeIds.join(',')) {
			fetcher.load(`/api/agent?${qp.toString()}`);
			idRef.current = nodeIds;
		}

		const intervalID = setInterval(() => {
			fetcher.load(`/api/agent?${qp.toString()}`);
		}, interval);

		return () => {
			clearInterval(intervalID);
		};
	}, [interval, qp]);

	return {
		data: fetcher.data,
		isLoading: fetcher.state === 'loading',
	};
}
