import { useEffect } from 'react';
import { useFetcher } from 'react-router';
import { HostInfo } from '~/types';

export default function useAgent(nodeIds: string[], interval = 3000) {
	const fetcher = useFetcher<Record<string, HostInfo>>();

	useEffect(() => {
		const qp = new URLSearchParams({ node_ids: nodeIds.join(',') });
		fetcher.load(`/api/agent?${qp.toString()}`);

		const intervalID = setInterval(() => {
			fetcher.load(`/api/agent?${qp.toString()}`);
		}, interval);

		return () => {
			clearInterval(intervalID);
		};
	}, [fetcher, interval, nodeIds]);

	return {
		data: fetcher.data,
		isLoading: fetcher.state === 'loading',
	};
}
