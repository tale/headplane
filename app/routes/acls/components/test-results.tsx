import {
	Check,
	CheckCircle,
	ChevronDown,
	ChevronRight,
	Shield,
	ShieldOff,
	X,
	XCircle,
} from 'lucide-react';
import { useState } from 'react';
import Card from '~/components/Card';
import IconButton from '~/components/IconButton';
import type { TestACLResponse } from '~/server/headscale/api/endpoints/policy';
import cn from '~/utils/cn';

interface TestResultsProps {
	results: TestACLResponse;
	onClose: () => void;
}

export function TestResults({ results, onClose }: TestResultsProps) {
	const passedCount = results.results.filter((r) => r.passed).length;
	const failedCount = results.results.length - passedCount;
	const allPassed = failedCount === 0 && results.results.length > 0;

	// Track which tests are expanded - failed tests expanded by default
	const [expanded, setExpanded] = useState<Set<number>>(() => {
		const initial = new Set<number>();
		results.results.forEach((r, i) => {
			if (!r.passed) initial.add(i);
		});
		return initial;
	});

	const toggleExpand = (index: number) => {
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(index)) {
				next.delete(index);
			} else {
				next.add(index);
			}
			return next;
		});
	};

	return (
		<Card className="mt-4 max-w-full" variant="flat">
			<div className="flex items-center justify-between mb-3">
				<div className="flex items-center gap-3">
					{allPassed ? (
						<CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
					) : (
						<XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
					)}
					<div>
						<Card.Title
							className={
								allPassed
									? 'text-green-600 dark:text-green-400'
									: 'text-red-600 dark:text-red-400'
							}
						>
							{allPassed ? 'All Tests Passed' : 'Tests Failed'}
						</Card.Title>
						<p className="text-sm text-ui-600 dark:text-ui-300">
							{passedCount} passed{failedCount > 0 && `, ${failedCount} failed`}{' '}
							of {results.results.length} tests
						</p>
					</div>
				</div>
				<IconButton label="Close results" onPress={onClose}>
					<X className="w-4 h-4" />
				</IconButton>
			</div>

			<div className="space-y-2">
				{results.results.map((result, index) => {
					const isExpanded = expanded.has(index);
					return (
						<div
							className={cn(
								'border rounded-xl overflow-hidden transition-colors',
								result.passed
									? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
									: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20',
							)}
							key={`test-${result.testIndex}`}
						>
							{/* Header - clickable to expand */}
							<button
								className="w-full flex items-center gap-2 p-3 text-left hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
								onClick={() => toggleExpand(index)}
								type="button"
							>
								{isExpanded ? (
									<ChevronDown className="w-4 h-4 shrink-0 text-ui-500" />
								) : (
									<ChevronRight className="w-4 h-4 shrink-0 text-ui-500" />
								)}
								{result.passed ? (
									<CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 shrink-0" />
								) : (
									<XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
								)}
								<span className="font-mono text-sm flex-1">
									Test #{result.testIndex + 1}: {result.src}
									{result.proto && (
										<span className="text-ui-500 ml-2">({result.proto})</span>
									)}
								</span>
								{!result.passed && (
									<span className="text-xs px-2 py-0.5 rounded-full bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-200">
										FAILED
									</span>
								)}
							</button>

							{/* Expanded details */}
							{isExpanded && (
								<div className="px-3 pb-3 pt-1 border-t border-inherit">
									{/* Errors */}
									{result.errors && result.errors.length > 0 && (
										<div className="mb-3 p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
											<p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-1">
												Errors
											</p>
											<ul className="text-sm text-red-600 dark:text-red-400 list-disc list-inside">
												{result.errors.map((err) => (
													<li key={err}>{err}</li>
												))}
											</ul>
										</div>
									)}

									{/* Accept rules */}
									{result.accept && result.accept.length > 0 && (
										<div className="mb-2">
											<div className="flex items-center gap-1 mb-1">
												<Shield className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
												<span className="text-xs font-semibold text-ui-700 dark:text-ui-200">
													Expected to ACCEPT
												</span>
											</div>
											<div className="flex flex-wrap gap-1.5 ml-5">
												{result.accept.map((dest) => {
													const passed = result.acceptOk?.includes(dest);
													const failed = result.acceptFail?.includes(dest);
													return (
														<span
															className={cn(
																'inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-xs',
																passed &&
																	'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200',
																failed &&
																	'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200',
																!passed &&
																	!failed &&
																	'bg-ui-200 dark:bg-ui-700 text-ui-700 dark:text-ui-200',
															)}
															key={dest}
														>
															{passed && (
																<Check className="w-3 h-3 text-green-600 dark:text-green-400" />
															)}
															{failed && (
																<X className="w-3 h-3 text-red-600 dark:text-red-400" />
															)}
															{dest}
														</span>
													);
												})}
											</div>
										</div>
									)}

									{/* Deny rules */}
									{result.deny && result.deny.length > 0 && (
										<div className="mb-2">
											<div className="flex items-center gap-1 mb-1">
												<ShieldOff className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
												<span className="text-xs font-semibold text-ui-700 dark:text-ui-200">
													Expected to DENY
												</span>
											</div>
											<div className="flex flex-wrap gap-1.5 ml-5">
												{result.deny.map((dest) => {
													const passed = result.denyOk?.includes(dest);
													const failed = result.denyFail?.includes(dest);
													return (
														<span
															className={cn(
																'inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-xs',
																passed &&
																	'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200',
																failed &&
																	'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200',
																!passed &&
																	!failed &&
																	'bg-ui-200 dark:bg-ui-700 text-ui-700 dark:text-ui-200',
															)}
															key={dest}
														>
															{passed && (
																<Check className="w-3 h-3 text-green-600 dark:text-green-400" />
															)}
															{failed && (
																<X className="w-3 h-3 text-red-600 dark:text-red-400" />
															)}
															{dest}
														</span>
													);
												})}
											</div>
										</div>
									)}

									{/* Summary for passed tests without explicit accept/deny */}
									{result.passed &&
										!result.accept?.length &&
										!result.deny?.length && (
											<p className="text-sm text-green-700 dark:text-green-300">
												Test passed
												{result.acceptOk && result.acceptOk.length > 0 && (
													<span>
														{' '}
														- {result.acceptOk.length} accept rule
														{result.acceptOk.length !== 1 && 's'} verified
													</span>
												)}
												{result.denyOk && result.denyOk.length > 0 && (
													<span>
														{' '}
														- {result.denyOk.length} deny rule
														{result.denyOk.length !== 1 && 's'} verified
													</span>
												)}
											</p>
										)}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</Card>
	);
}
