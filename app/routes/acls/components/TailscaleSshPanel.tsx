import { Fragment, useState } from 'react';
import Button from '~/components/Button';

type TailscaleSshRule = {
	id: string;
	source: string;
	destination: string;
	users: string;
	checkMode?: string;
};

function getTailscaleSshRules(): TailscaleSshRule[] {
	// Placeholder implementation mirroring the example rule from the design.
	// In the future this can be wired to real ACL SSH rule data or user input.
	return [
		{
			id: 'check-own-devices',
			source: 'autogroup:member',
			destination: 'autogroup:self',
			users: 'autogroup:nonroot, root',
			checkMode: 'check',
		},
	];
}

export default function TailscaleSshPanel() {
	const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
	const rules = getTailscaleSshRules();

	return (
		<div className="mt-4">
			<section className="flex flex-col sm:flex-row gap-4 sm:justify-between mt-4">
				<div className="relative w-full max-w-2xl sm:flex-shrink">
					<div className="relative">
						<div className="focus-within:ring-1 focus-within:ring-headplane-400 flex flex-row rounded-md border border-headplane-200 hover:border-headplane-300 px-3 py-1 pl-2">
							<svg
								aria-hidden="true"
								className="text-headplane-400 mr-2 mt-1 flex-shrink-0"
								fill="none"
								height="20"
								stroke="currentColor"
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								viewBox="0 0 24 24"
								width="20"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path d="m21 21-4.34-4.34" />
								<circle cx="11" cy="11" r="8" />
							</svg>
							<div className="flex flex-row items-center flex-wrap gap-1 self-stretch flex-grow py-px">
								<input
									className="input border-none flex-shrink flex-grow mr-0 pl-0 min-w-0 w-9 focus:outline-none h-6"
									placeholder="Search by user, group, device, action...etc."
									type="text"
								/>
							</div>
							<button
								aria-label="toggle search menu"
								className="self-start"
								type="button"
							>
								<svg
									aria-hidden="true"
									className="text-headplane-400 w-4 mt-0.5 flex-shrink-0"
									fill="none"
									height="20"
									stroke="currentColor"
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									viewBox="0 0 24 24"
									width="20"
									xmlns="http://www.w3.org/2000/svg"
								>
									<path d="m6 9 6 6 6-6" />
								</svg>
							</button>
						</div>
					</div>
				</div>

				<div className="flex justify-end">
					<Button className="h-9 px-3 flex items-center gap-2" variant="heavy">
						<span className="flex-shrink-0">
							<svg
								aria-hidden="true"
								fill="none"
								height="20"
								stroke="currentColor"
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
								viewBox="0 0 24 24"
								width="20"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path d="M5 12h14" />
								<path d="M12 5v14" />
							</svg>
						</span>
						<span className="max-w-full">Add rule</span>
					</Button>
				</div>
			</section>

			<section>
				<div className="border rounded-lg mt-6 overflow-x-auto overflow-y-hidden">
					<table className="w-full">
						<thead className="border-b">
							<tr>
								<td className="pl-11 pr-3 py-2 text-sm text-headplane-500 align-middle font-normal">
									Sources
								</td>
								<td className="pl-1 pr-3 py-2 text-sm text-headplane-500 align-middle font-normal">
									can access destinations
								</td>
								<td className="pl-1 pr-3 py-2 text-sm text-headplane-500 align-middle font-normal">
									as user
								</td>
								<td className="pl-1 pr-3 py-2 text-sm text-headplane-500 align-middle font-normal">
									with check mode
								</td>
								<td className="pl-1 pr-3 py-2 text-sm text-headplane-500 align-middle font-normal">
									<span className="sr-only">Comment</span>
								</td>
								<td className="pl-1 pr-3 py-2 text-sm text-headplane-500 align-middle min-w-[4%] font-normal">
									<span className="sr-only">SSH action menu</span>
								</td>
							</tr>
						</thead>
						<tbody className="border-b last:border-0 isolate">
							{rules.map((rule) => {
								const isExpanded = rule.id === expandedRuleId;

								return (
									<Fragment key={rule.id}>
										<tr
											aria-expanded={isExpanded}
											className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
											onClick={() =>
												setExpandedRuleId(isExpanded ? null : rule.id)
											}
										>
											<td className="pl-1 pr-3 py-4 h-[3.25rem] align-middle">
												<div className="float-left">
													<svg
														aria-hidden="true"
														className={
															'text-headplane-400 w-4 ml-2 transition-transform ' +
															(isExpanded ? 'rotate-90' : '')
														}
														fill="none"
														height="20"
														stroke="currentColor"
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth="3"
														viewBox="0 0 24 24"
														width="20"
														xmlns="http://www.w3.org/2000/svg"
													>
														<path d="m9 18 6-6-6-6" />
													</svg>
												</div>
												<div className="leading-6 ml-10">
													<div className="grid grid-col-1">
														<div className="w-full truncate">
															<span>{rule.source}</span>
														</div>
													</div>
												</div>
											</td>
											<td className="pl-1 pr-3 py-4 h-[3.25rem] align-middle">
												<div className="grid grid-col-1">
													<div className="w-full truncate">
														<span>{rule.destination}</span>
													</div>
												</div>
											</td>
											<td className="pl-1 pr-3 py-4 h-[3.25rem] align-middle">
												<div className="grid grid-col-1">
													<div className="w-full truncate">
														<span>{rule.users}</span>
													</div>
												</div>
											</td>
											<td className="pl-1 pr-3 py-4 h-[3.25rem] align-middle">
												{rule.checkMode ? <span>{rule.checkMode}</span> : null}
											</td>
											<td className="pl-1 pr-3 py-4 h-[3.25rem] align-middle">
												<span>
													<svg
														aria-hidden="true"
														className="w-4 h-4 text-headplane-400"
														fill="none"
														height="20"
														stroke="currentColor"
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth="2"
														viewBox="0 0 24 24"
														width="20"
														xmlns="http://www.w3.org/2000/svg"
													>
														<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
														<path d="M14 2v4a2 2 0 0 0 2 2h4" />
														<path d="M10 9H8" />
														<path d="M16 13H8" />
														<path d="M16 17H8" />
													</svg>
												</span>
											</td>
											<td className="flex justify-end ml-auto md:ml-0 relative py-4 pl-1 pr-3 h-[3.25rem] align-middle">
												<button
													aria-label={`Actions for SSH rule ${rule.id}`}
													className="py-0.5 px-2 rounded-md border border-transparent hover:border-headplane-300 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-none hover:shadow-md transition-shadow duration-100 ease-in-out"
													type="button"
												>
													<svg
														aria-hidden="true"
														className="text-headplane-400"
														fill="none"
														height="18"
														stroke="currentColor"
														strokeLinecap="round"
														strokeLinejoin="round"
														strokeWidth="2"
														viewBox="0 0 24 24"
														width="18"
														xmlns="http://www.w3.org/2000/svg"
													>
														<circle cx="12" cy="12" r="1" />
														<circle cx="19" cy="12" r="1" />
														<circle cx="5" cy="12" r="1" />
													</svg>
												</button>
											</td>
										</tr>

										{isExpanded ? (
											<tr>
												<td
													className="p-4 align-middle bg-gray-50 dark:bg-gray-900 border-t"
													colSpan={6}
												>
													<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
														<div className="gap-1 grid grid-cols-[1fr_3fr] auto-rows-max text-sm">
															<div className="font-semibold mb-1">Source</div>
															<div>{rule.source}</div>
															<div className="font-semibold mb-1">
																Destination
															</div>
															<div>{rule.destination}</div>
															<div className="font-semibold mb-1">Users</div>
															<div>{rule.users}</div>
															<div className="font-semibold mb-1">Action</div>
															<div>{rule.checkMode ?? 'check'}</div>
															<div className="font-semibold mb-1">Note</div>
															<div>
																Allow all users to SSH into their own devices in
																check mode. Comment this section out if you want
																to define specific restrictions.
															</div>
														</div>
														<div className="border-l pl-4 ml-4 leading-5 text-xs md:text-sm">
															<pre className="overflow-hidden">
																<code className="whitespace-pre-wrap">
																	{`// Allow all users to SSH into their own devices in check mode.
// Comment this section out if you want to define specific restrictions.
{"action": "check", "src": ["autogroup:member"], "dst": ["autogroup:self"], "users": ["autogroup:nonroot", "root"]},`}
																</code>
															</pre>
														</div>
													</div>
												</td>
											</tr>
										) : null}
									</Fragment>
								);
							})}
						</tbody>
					</table>
				</div>
			</section>

			<div className="flex justify-between mt-4" />
		</div>
	);
}
