import { useEffect, useMemo, useRef } from 'react';
import { useFetcher } from 'react-router';
import { HostInfo } from '~/types';

export default function useAgent(nodeIds: string[]) {
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
	}, [qp.toString()]);

	return {
		data: fetcher.data,
		isLoading: fetcher.state === 'loading',
	};
}
