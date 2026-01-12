import { useCallback, useEffect, useRef, useState } from 'react';
import { useFetcher, useRevalidator } from 'react-router';
import type { TestACLResponse } from '~/server/headscale/api/endpoints/policy';
import toast from '~/utils/toast';
import type { aclAction } from '../acl-action';
import {
	parseSyntaxErrorLocation,
	type SyntaxErrorLocation,
} from '../utils/parsing';

interface EditorState {
	testResults: TestACLResponse | null;
	testError: string | null;
	saveError: string | undefined;
	syntaxError: SyntaxErrorLocation | null;
	pendingTestAfterSaveError: boolean;
}

export function useACLEditor(initialPolicy: string) {
	const [codePolicy, setCodePolicy] = useState(initialPolicy);
	const [state, setState] = useState<EditorState>({
		testResults: null,
		testError: null,
		saveError: undefined,
		syntaxError: null,
		pendingTestAfterSaveError: false,
	});

	const fetcher = useFetcher<typeof aclAction>();
	const { revalidate } = useRevalidator();

	// Track policy for auto-test trigger
	const codePolicyRef = useRef(codePolicy);
	codePolicyRef.current = codePolicy;

	// Track which fetcher response we've already processed to avoid re-processing
	const processedDataRef = useRef<typeof fetcher.data | null>(null);

	// Sync with loader data when it changes
	useEffect(() => {
		if (initialPolicy !== codePolicy) {
			setCodePolicy(initialPolicy);
		}
	}, [initialPolicy]);

	// Reset state when policy changes
	useEffect(() => {
		setState({
			testResults: null,
			testError: null,
			saveError: undefined,
			syntaxError: null,
			pendingTestAfterSaveError: false,
		});
	}, [codePolicy]);

	const runTests = useCallback(() => {
		const formData = new FormData();
		formData.append('action', 'test_policy');
		formData.append('policy', codePolicyRef.current);
		fetcher.submit(formData, { method: 'POST' });
	}, [fetcher]);

	// Auto-run tests after save error when fetcher becomes idle
	useEffect(() => {
		if (state.pendingTestAfterSaveError && fetcher.state === 'idle') {
			setState((s) => ({ ...s, pendingTestAfterSaveError: false }));
			runTests();
		}
	}, [state.pendingTestAfterSaveError, fetcher.state, runTests]);

	// Handle fetcher responses
	useEffect(() => {
		if (!fetcher.data) return;

		// Skip if we've already processed this exact response
		if (processedDataRef.current === fetcher.data) return;
		processedDataRef.current = fetcher.data;

		const data = fetcher.data;

		// Test policy response
		if ('action' in data && data.action === 'test_policy') {
			if (data.success && data.testResults) {
				const results = data.testResults;
				setState((s) => {
					// Only show toast if this wasn't triggered by a save error
					if (!s.saveError) {
						toast(
							results.allPassed ? 'All tests passed!' : 'Some tests failed',
						);
					}
					return {
						...s,
						testResults: results,
						testError: null,
						syntaxError: null,
					};
				});
			} else if (!data.success && data.error) {
				const error = data.error;
				// Try to parse syntax error location
				const syntaxError =
					parseSyntaxErrorLocation(error, codePolicyRef.current) ?? null;
				setState((s) => ({
					...s,
					testError: error,
					testResults: null,
					syntaxError,
				}));
			}
			return;
		}

		// Save policy response
		if ('action' in data && data.action === 'save_policy') {
			if (data.success) {
				toast('Updated policy');
				revalidate();
				setState({
					testResults: null,
					testError: null,
					saveError: undefined,
					syntaxError: null,
					pendingTestAfterSaveError: false,
				});
				return;
			}

			// Save failed - show error and schedule auto-test
			const error = data.error;
			const results = data.testResults;
			// Try to parse syntax error location
			const syntaxError = error
				? (parseSyntaxErrorLocation(error, codePolicyRef.current) ?? null)
				: null;
			setState((s) => ({
				...s,
				saveError: error,
				testResults: results ?? null,
				syntaxError,
				// Schedule test run if no results from server and no syntax error
				pendingTestAfterSaveError: !results && !syntaxError,
			}));
			toast('Save failed');
		}
	}, [fetcher.data, revalidate]);

	const save = () => {
		const formData = new FormData();
		formData.append('policy', codePolicy);
		fetcher.submit(formData, { method: 'PATCH' });
	};

	const clearTestResults = () => {
		setState((s) => ({
			...s,
			testResults: null,
			saveError: undefined,
			syntaxError: null,
		}));
	};

	return {
		codePolicy,
		setCodePolicy,
		isLoading: fetcher.state !== 'idle',
		hasChanges: codePolicy !== initialPolicy,
		...state,
		save,
		runTests,
		clearTestResults,
	};
}
