import { type ReactNode, useMemo, useState } from 'react';
import cn from '~/utils/cn';
import AddGeneralAccessRuleDialog from './AddGeneralAccessRuleDialog';
import AddGroupDialog, { type NewGroupInput } from './AddGroupDialog';
import AddHostDialog, { type NewHostInput } from './AddHostDialog';
import AddTagOwnerDialog, { type NewTagOwnerInput } from './AddTagOwnerDialog';
import EditGeneralAccessRuleDialog from './EditGeneralAccessRuleDialog';
import EditGroupDialog from './EditGroupDialog';
import EditHostDialog from './EditHostDialog';
import EditTagOwnerDialog from './EditTagOwnerDialog';
import GeneralAccessRulesPanel, {
	type GeneralAccessRule,
} from './GeneralAccessRulesPanel';
import GroupsPanel, { type GroupEntry } from './GroupsPanel';
import HostsPanel, { type HostEntry } from './HostsPanel';
import TagsPanel, { type TagOwnerEntry } from './TagsPanel';
import TailscaleSshPanel from './TailscaleSshPanel';

export type VisualEditorTab =
	| 'general-access-rules'
	| 'tailscale-ssh'
	| 'groups'
	| 'tags'
	| 'hosts';

interface TabConfig {
	key: VisualEditorTab;
	label: string;
	panel: ReactNode;
}

function extractAclNotes(policy: string): string[] {
	// Extract comment lines starting with // directly above each ACL rule
	// inside the "acls" array. Each group of consecutive comment lines
	// becomes the note for the next rule object.
	const lines = policy.split(/\r?\n/);
	const notes: string[] = [];
	let inAclsSection = false;
	let depth = 0;
	let pending: string[] = [];

	for (const rawLine of lines) {
		const line = rawLine;

		if (!inAclsSection) {
			if (/"acls"\s*:\s*\[/.test(line)) {
				inAclsSection = true;
				// We just entered the acls array.
				depth = 1;
			}
			continue;
		}

		const openBrackets = (line.match(/\[/g) ?? []).length;
		const closeBrackets = (line.match(/\]/g) ?? []).length;
		depth += openBrackets - closeBrackets;

		if (depth <= 0) {
			break;
		}

		const trimmed = line.trim();

		if (trimmed.startsWith('//')) {
			pending.push(trimmed.replace(/^\/\/\s?/, '').trim());
			continue;
		}

		if (trimmed.startsWith('{')) {
			const note = pending.join('\n').trim();
			notes.push(note);
			pending = [];
		}
	}

	return notes;
}

function deleteAclFromPolicy(
	policy: string,
	rule: GeneralAccessRule,
): string | null {
	const index = Number(rule.id.replace(/^acl-/, ''));
	if (!policy || !policy.trim() || Number.isNaN(index) || index < 0) {
		return null;
	}

	// We want to preserve comments and overall formatting as much as possible.
	// Instead of reparsing and re-stringifying the whole document, operate
	// directly on the "acls" array text and remove the targeted rule object
	// (and its preceding comment block) from the original string.
	if (!/"acls"\s*:\s*\[/.test(policy)) {
		// For now we only support comment-preserving deletion for lowercase "acls".
		// If the structure is different, do nothing to avoid rewriting the policy.
		return null;
	}

	const lines = policy.split(/\r?\n/);
	let inAcls = false;
	let bracketDepth = 0;
	let objectDepth = 0;
	let currentRule = -1;
	let commentStart: number | null = null;
	const ranges: { start: number; end: number }[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (!inAcls) {
			if (/"acls"\s*:\s*\[/.test(line)) {
				inAcls = true;
				const open = (line.match(/\[/g) ?? []).length;
				const close = (line.match(/\]/g) ?? []).length;
				bracketDepth += open - close;
			}
			continue;
		}

		const openBrackets = (line.match(/\[/g) ?? []).length;
		const closeBrackets = (line.match(/\]/g) ?? []).length;
		bracketDepth += openBrackets - closeBrackets;

		const trimmed = line.trim();

		if (bracketDepth <= 0) {
			// We've exited the "acls" array.
			break;
		}

		// Track comment blocks that precede a rule object.
		if (objectDepth === 0 && trimmed.startsWith('//')) {
			if (commentStart === null) {
				commentStart = i;
			}
		}

		const openBraces = (line.match(/{/g) ?? []).length;
		const closeBraces = (line.match(/}/g) ?? []).length;

		// Starting a new rule object.
		if (objectDepth === 0 && openBraces > 0 && trimmed.startsWith('{')) {
			currentRule += 1;
			const start = commentStart ?? i;
			ranges[currentRule] = { start, end: i };
			commentStart = null;
		}

		objectDepth += openBraces - closeBraces;

		// Finished a rule object (objectDepth just returned to 0).
		if (
			objectDepth === 0 &&
			openBraces + closeBraces > 0 &&
			ranges[currentRule]
		) {
			let end = i;
			const trimmedEnd = lines[end].trim();

			// If the closing line doesn't end with a comma, there may be a comma
			// on the following line; include it to keep array commas valid.
			if (!trimmedEnd.endsWith(',')) {
				let j = end + 1;
				while (j < lines.length && lines[j].trim() === '') {
					j++;
				}
				if (j < lines.length && lines[j].trim() === ',') {
					end = j;
				}
			}

			ranges[currentRule].end = end;
		}
	}

	const target = ranges[index];
	if (!target) {
		return null;
	}

	const nextLines = [
		...lines.slice(0, target.start),
		...lines.slice(target.end + 1),
	];

	return nextLines.join('\n');
}

function addAclToPolicy(
	policy: string,
	input: {
		source: string;
		destination: string;
		protocol: string;
		note: string;
	},
): string | null {
	if (!policy || !policy.trim()) {
		return null;
	}

	// As with deletion, only support comment-preserving insertion
	// for the lowercase "acls" structure.
	if (!/"acls"\s*:\s*\[/.test(policy)) {
		return null;
	}

	const lines = policy.split(/\r?\n/);

	let aclsStart = -1;
	let inAcls = false;
	let bracketDepth = 0;
	let arrayEnd = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (!inAcls) {
			if (/"acls"\s*:\s*\[/.test(line)) {
				inAcls = true;
				aclsStart = i;
				const open = (line.match(/\[/g) ?? []).length;
				const close = (line.match(/\]/g) ?? []).length;
				bracketDepth += open - close;

				if (bracketDepth <= 0) {
					arrayEnd = i;
					break;
				}
			}
			continue;
		}

		const openBrackets = (line.match(/\[/g) ?? []).length;
		const closeBrackets = (line.match(/\]/g) ?? []).length;
		bracketDepth += openBrackets - closeBrackets;

		if (bracketDepth <= 0) {
			arrayEnd = i;
			break;
		}
	}

	if (aclsStart === -1 || arrayEnd === -1) {
		return null;
	}

	// Determine indentation for entries and whether there are existing rules.
	let entryIndent = '';
	let hasExistingRules = false;

	for (let i = aclsStart + 1; i < arrayEnd; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		if (!trimmed || trimmed.startsWith('//')) {
			continue;
		}

		if (trimmed.startsWith('{')) {
			hasExistingRules = true;
			entryIndent = line.slice(0, line.indexOf(trimmed));
			break;
		}
	}

	if (!entryIndent) {
		const aclsLine = lines[aclsStart];
		const match = /^(\s*)/.exec(aclsLine);
		const baseIndent = match ? match[1] : '';
		entryIndent = `${baseIndent}  `;
	}

	const toArray = (value: string): string[] =>
		value
			.split(',')
			.map((part) => part.trim())
			.filter(Boolean);

	const src = toArray(input.source);
	const dst = toArray(input.destination);
	const proto = input.protocol.trim();

	// If there are existing rules, ensure the previous last rule line
	// ends with a comma so that the new rule becomes a valid next element,
	// without introducing a standalone comma line that would break JSON.
	if (hasExistingRules) {
		for (let i = arrayEnd - 1; i > aclsStart; i--) {
			const candidate = lines[i];
			const trimmedCandidate = candidate.trim();
			if (!trimmedCandidate || trimmedCandidate.startsWith('//')) {
				continue;
			}

			if (!trimmedCandidate.endsWith(',')) {
				const match = /(.*\S)(\s*)$/.exec(candidate);
				if (match) {
					lines[i] = `${match[1]},${match[2]}`;
				} else {
					lines[i] = `${trimmedCandidate},`;
				}
			}
			break;
		}
	}

	const newLines: string[] = [];

	if (input.note && input.note.trim()) {
		for (const rawLine of input.note.split('\n')) {
			const trimmed = rawLine.trim();
			if (!trimmed) {
				continue;
			}
			newLines.push(`${entryIndent}// ${trimmed}`);
		}
	}

	const aclObject: any = { action: 'accept' };

	if (src.length) {
		aclObject.src = src;
	}
	if (dst.length) {
		aclObject.dst = dst;
	}
	if (proto) {
		aclObject.proto = proto;
	}

	// Emit ACL objects in single-line form, with spaces for readability on keys
	// while preserving any colons that appear inside string values (e.g. "tag:none").
	const json = JSON.stringify(aclObject)
		.replace(/"([^"]+)":/g, '"$1": ')
		.replace(/,"/g, ', "');

	if (hasExistingRules) {
		// New rule is appended as the last element in the array, so it does not
		// need a trailing comma (the previous rule line already has one).
		newLines.push(`${entryIndent}${json}`);
	} else {
		// Single-entry ACL arrays use a trailing comma style.
		newLines.push(`${entryIndent}${json},`);
	}

	const before = lines.slice(0, arrayEnd);
	const after = lines.slice(arrayEnd);

	const insertion: string[] = [];
	insertion.push(...newLines);

	const resultLines = [...before, ...insertion, ...after];

	return resultLines.join('\n');
}

function updateAclInPolicy(
	policy: string,
	index: number,
	input: {
		source: string;
		destination: string;
		protocol: string;
		note: string;
	},
): string | null {
	if (
		!policy ||
		!policy.trim() ||
		Number.isNaN(index) ||
		index < 0 ||
		!/"acls"\s*:\s*\[/.test(policy)
	) {
		return null;
	}

	const lines = policy.split(/\r?\n/);

	let inAcls = false;
	let bracketDepth = 0;
	let objectDepth = 0;
	let aclsStart = -1;
	let arrayEnd = -1;
	let currentRule = -1;
	let commentStart: number | null = null;
	const ranges: { start: number; end: number }[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (!inAcls) {
			if (/"acls"\s*:\s*\[/.test(line)) {
				inAcls = true;
				aclsStart = i;
				const open = (line.match(/\[/g) ?? []).length;
				const close = (line.match(/\]/g) ?? []).length;
				bracketDepth += open - close;
			}
			continue;
		}

		const openBrackets = (line.match(/\[/g) ?? []).length;
		const closeBrackets = (line.match(/\]/g) ?? []).length;
		bracketDepth += openBrackets - closeBrackets;

		const trimmed = line.trim();

		if (bracketDepth <= 0) {
			arrayEnd = i;
			break;
		}

		// Track comment blocks that precede a rule object.
		if (objectDepth === 0 && trimmed.startsWith('//')) {
			if (commentStart === null) {
				commentStart = i;
			}
		}

		const openBraces = (line.match(/{/g) ?? []).length;
		const closeBraces = (line.match(/}/g) ?? []).length;

		// Starting a new rule object.
		if (objectDepth === 0 && openBraces > 0 && trimmed.startsWith('{')) {
			currentRule += 1;
			const start = commentStart ?? i;
			ranges[currentRule] = { start, end: i };
			commentStart = null;
		}

		objectDepth += openBraces - closeBraces;

		// Finished a rule object (objectDepth just returned to 0).
		if (
			objectDepth === 0 &&
			openBraces + closeBraces > 0 &&
			ranges[currentRule]
		) {
			let end = i;
			const trimmedEnd = lines[end].trim();

			// If the closing line doesn't end with a comma, there may be a comma
			// on the following line; include it to keep array commas valid.
			if (!trimmedEnd.endsWith(',')) {
				let j = end + 1;
				while (j < lines.length && lines[j].trim() === '') {
					j++;
				}
				if (j < lines.length && lines[j].trim() === ',') {
					end = j;
				}
			}

			ranges[currentRule].end = end;
		}
	}

	if (aclsStart === -1 || arrayEnd === -1) {
		return null;
	}

	const target = ranges[index];
	if (!target) {
		return null;
	}

	// Derive indentation for this entry from its opening brace, or fall back
	// to a default based on the "acls" line if needed.
	let entryIndent = '';
	for (let i = target.start; i <= target.end; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		if (!trimmed || trimmed.startsWith('//')) {
			continue;
		}

		if (trimmed.startsWith('{')) {
			entryIndent = line.slice(0, line.indexOf(trimmed));
			break;
		}
	}

	if (!entryIndent) {
		const aclsLine = lines[aclsStart];
		const match = /^(\s*)/.exec(aclsLine);
		const baseIndent = match ? match[1] : '';
		entryIndent = `${baseIndent}  `;
	}

	const toArray = (value: string): string[] =>
		value
			.split(',')
			.map((part) => part.trim())
			.filter(Boolean);

	const src = toArray(input.source);
	const dst = toArray(input.destination);
	const proto = input.protocol.trim();

	// Build the replacement block (comments + JSON object) without worrying
	// about the trailing comma yet.
	const replacementCore: string[] = [];

	if (input.note && input.note.trim()) {
		for (const rawLine of input.note.split('\n')) {
			const trimmed = rawLine.trim();
			if (!trimmed) {
				continue;
			}
			replacementCore.push(`${entryIndent}// ${trimmed}`);
		}
	}

	const aclObject: any = { action: 'accept' };

	if (src.length) {
		aclObject.src = src;
	}
	if (dst.length) {
		aclObject.dst = dst;
	}
	if (proto) {
		aclObject.proto = proto;
	}

	// Emit ACL objects in single-line form, with spaces for readability on keys,
	// and always with a trailing comma (HuJSON style), while preserving any
	// colons inside string values (e.g. "tag:none").
	const json = JSON.stringify(aclObject)
		.replace(/"([^"]+)":/g, '"$1": ')
		.replace(/,"/g, ', "');
	replacementCore.push(`${entryIndent}${json},`);

	const replacement: string[] = [];

	replacement.push(...replacementCore);

	const nextLines = [
		...lines.slice(0, target.start),
		...replacement,
		...lines.slice(target.end + 1),
	];

	return nextLines.join('\n');
}

function reorderAclsInPolicy(
	policy: string,
	orderedRuleIds: number[],
): string | null {
	if (!policy || !policy.trim()) {
		return null;
	}

	if (!/"acls"\s*:\s*\[/.test(policy)) {
		return null;
	}

	const lines = policy.split(/\r?\n/);

	let inAcls = false;
	let bracketDepth = 0;
	let objectDepth = 0;
	let aclsStart = -1;
	let arrayEnd = -1;
	let currentRule = -1;
	let commentStart: number | null = null;
	const ranges: { start: number; end: number }[] = [];

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (!inAcls) {
			if (/"acls"\s*:\s*\[/.test(line)) {
				inAcls = true;
				aclsStart = i;
				const open = (line.match(/\[/g) ?? []).length;
				const close = (line.match(/\]/g) ?? []).length;
				bracketDepth += open - close;
			}
			continue;
		}

		const openBrackets = (line.match(/\[/g) ?? []).length;
		const closeBrackets = (line.match(/\]/g) ?? []).length;
		bracketDepth += openBrackets - closeBrackets;

		const trimmed = line.trim();

		if (bracketDepth <= 0) {
			arrayEnd = i;
			break;
		}

		// Track comment blocks that precede a rule object.
		if (objectDepth === 0 && trimmed.startsWith('//')) {
			if (commentStart === null) {
				commentStart = i;
			}
		}

		const openBraces = (line.match(/{/g) ?? []).length;
		const closeBraces = (line.match(/}/g) ?? []).length;

		// Starting a new rule object.
		if (objectDepth === 0 && openBraces > 0 && trimmed.startsWith('{')) {
			currentRule += 1;
			const start = commentStart ?? i;
			ranges[currentRule] = { start, end: i };
			commentStart = null;
		}

		objectDepth += openBraces - closeBraces;

		// Finished a rule object (objectDepth just returned to 0).
		if (
			objectDepth === 0 &&
			openBraces + closeBraces > 0 &&
			ranges[currentRule]
		) {
			let end = i;
			const trimmedEnd = lines[end].trim();

			// If the closing line doesn't end with a comma, there may be a comma
			// on the following line; include it to keep array commas valid.
			if (!trimmedEnd.endsWith(',')) {
				let j = end + 1;
				while (j < lines.length && lines[j].trim() === '') {
					j++;
				}
				if (j < lines.length && lines[j].trim() === ',') {
					end = j;
				}
			}

			ranges[currentRule].end = end;
		}
	}

	if (aclsStart === -1 || arrayEnd === -1 || ranges.length === 0) {
		return null;
	}

	const order = orderedRuleIds
		.map((idx) =>
			Number.isNaN(idx) || idx < 0 || idx >= ranges.length ? null : idx,
		)
		.filter((idx): idx is number => idx !== null);

	if (order.length === 0) {
		return null;
	}

	const firstStart = ranges[0].start;
	const lastEnd = ranges[ranges.length - 1].end;

	const before = lines.slice(0, firstStart);
	const after = lines.slice(lastEnd + 1);

	const buildCleanBlock = (range: { start: number; end: number }): string[] => {
		const blockLines = lines.slice(range.start, range.end + 1);

		// Remove trailing comma from the block (either on its own line or on the closing brace line)
		let lastNonEmpty = blockLines.length - 1;
		while (lastNonEmpty >= 0 && blockLines[lastNonEmpty].trim() === '') {
			lastNonEmpty--;
		}
		if (lastNonEmpty < 0) {
			return blockLines;
		}

		const lastLine = blockLines[lastNonEmpty];
		const trimmedLast = lastLine.trim();

		if (trimmedLast === ',') {
			// Comma on its own line
			blockLines.splice(lastNonEmpty, 1);
		} else if (trimmedLast.endsWith(',')) {
			// Comma at end of the line, usually after a closing brace
			const commaIndex = lastLine.lastIndexOf(',');
			if (commaIndex !== -1) {
				blockLines[lastNonEmpty] =
					lastLine.slice(0, commaIndex) + lastLine.slice(commaIndex + 1);
			}
		}

		return blockLines;
	};

	const reorderedBlocks: string[] = [];

	order.forEach((idx, position) => {
		const block = buildCleanBlock(ranges[idx]);
		const isLastBlock = position === order.length - 1;

		block.forEach((line, lineIndex) => {
			const isLastLineOfBlock = lineIndex === block.length - 1;

			if (!isLastBlock && isLastLineOfBlock) {
				// For all but the last block, ensure a trailing comma at the end of the block.
				const trimmedEnd = line.trimEnd();
				if (trimmedEnd.endsWith('}')) {
					const match = /(.*\S)(\s*)$/.exec(line);
					if (match) {
						reorderedBlocks.push(`${match[1]},${match[2]}`);
					} else {
						reorderedBlocks.push(`${trimmedEnd},`);
					}
				} else {
					// Fallback: keep the line as-is and add a comma-only line with matching indent.
					reorderedBlocks.push(line);
					const indentMatch = /^(\s*)/.exec(line);
					const indent = indentMatch ? indentMatch[1] : '';
					reorderedBlocks.push(`${indent},`);
				}
			} else {
				reorderedBlocks.push(line);
			}
		});
	});

	const resultLines = [...before, ...reorderedBlocks, ...after];

	return resultLines.join('\n');
}

function reorderHostsInPolicy(
	policy: string,
	orderedHostIds: number[],
): string | null {
	if (!policy || !policy.trim()) {
		return null;
	}

	if (!/"hosts"\s*:\s*{/.test(policy)) {
		return null;
	}

	const lines = policy.split(/\r?\n/);

	let hostsStart = -1;
	let inHosts = false;
	let braceDepth = 0;
	let hostsEnd = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (!inHosts) {
			if (/"hosts"\s*:\s*{/.test(line)) {
				inHosts = true;
				hostsStart = i;
				const open = (line.match(/{/g) ?? []).length;
				const close = (line.match(/}/g) ?? []).length;
				braceDepth += open - close;
			}
			continue;
		}

		const openBraces = (line.match(/{/g) ?? []).length;
		const closeBraces = (line.match(/}/g) ?? []).length;
		braceDepth += openBraces - closeBraces;

		if (braceDepth <= 0) {
			hostsEnd = i;
			break;
		}
	}

	if (hostsStart === -1 || hostsEnd === -1) {
		return null;
	}

	const entries: { start: number; end: number }[] = [];
	let commentStart: number | null = null;

	for (let i = hostsStart + 1; i < hostsEnd; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		if (!trimmed) {
			continue;
		}

		if (trimmed.startsWith('//')) {
			if (commentStart === null) {
				commentStart = i;
			}
			continue;
		}

		const match = trimmed.match(/^"([^"]+)"\s*:/);
		if (match) {
			const start = commentStart ?? i;
			let end = i;

			const trimmedEnd = lines[end].trim();
			if (!trimmedEnd.endsWith(',')) {
				let j = end + 1;
				while (j < hostsEnd && lines[j].trim() === '') {
					j++;
				}
				if (j < hostsEnd && lines[j].trim() === ',') {
					end = j;
				}
			}

			entries.push({ start, end });
			commentStart = null;
			continue;
		}

		commentStart = null;
	}

	if (entries.length === 0) {
		return null;
	}

	const order = orderedHostIds
		.map((idx) =>
			Number.isNaN(idx) || idx < 0 || idx >= entries.length ? null : idx,
		)
		.filter((idx): idx is number => idx !== null);

	if (order.length === 0) {
		return null;
	}

	const firstStart = entries[0].start;
	const lastEnd = entries[entries.length - 1].end;

	const before = lines.slice(0, firstStart);
	const after = lines.slice(lastEnd + 1);

	const buildCleanBlock = (range: { start: number; end: number }): string[] => {
		const blockLines = lines.slice(range.start, range.end + 1);

		// Remove trailing comma from the block (either on its own line or on the property line)
		let lastNonEmpty = blockLines.length - 1;
		while (lastNonEmpty >= 0 && blockLines[lastNonEmpty].trim() === '') {
			lastNonEmpty--;
		}
		if (lastNonEmpty < 0) {
			return blockLines;
		}

		const lastLine = blockLines[lastNonEmpty];
		const trimmedLast = lastLine.trim();

		if (trimmedLast === ',') {
			// Comma on its own line
			blockLines.splice(lastNonEmpty, 1);
		} else if (trimmedLast.endsWith(',')) {
			// Comma at end of the line, usually after the property
			const commaIndex = lastLine.lastIndexOf(',');
			if (commaIndex !== -1) {
				blockLines[lastNonEmpty] =
					lastLine.slice(0, commaIndex) + lastLine.slice(commaIndex + 1);
			}
		}

		return blockLines;
	};

	const reorderedBlocks: string[] = [];

	order.forEach((idx, position) => {
		const block = buildCleanBlock(entries[idx]);
		const isLastBlock = position === order.length - 1;

		block.forEach((line, lineIndex) => {
			const isLastLineOfBlock = lineIndex === block.length - 1;

			if (!isLastBlock && isLastLineOfBlock) {
				// For all but the last block, ensure a trailing comma at the end of the block.
				const trimmedEnd = line.trimEnd();
				if (trimmedEnd.endsWith('"')) {
					const match = /(.*\S)(\s*)$/.exec(line);
					if (match) {
						reorderedBlocks.push(`${match[1]},${match[2]}`);
					} else {
						reorderedBlocks.push(`${trimmedEnd},`);
					}
				} else {
					// Fallback: keep the line as-is and add a comma-only line with matching indent.
					reorderedBlocks.push(line);
					const indentMatch = /^(\s*)/.exec(line);
					const indent = indentMatch ? indentMatch[1] : '';
					reorderedBlocks.push(`${indent},`);
				}
			} else {
				reorderedBlocks.push(line);
			}
		});
	});

	const resultLines = [...before, ...reorderedBlocks, ...after];

	return resultLines.join('\n');
}

function extractHostNotes(policy: string): Record<string, string> {
	const lines = policy.split(/\r?\n/);
	const notes: Record<string, string> = {};
	let inHosts = false;
	let braceDepth = 0;
	let pending: string[] = [];

	for (const rawLine of lines) {
		const line = rawLine;

		if (!inHosts) {
			if (/"hosts"\s*:\s*{/.test(line)) {
				inHosts = true;
				const open = (line.match(/{/g) ?? []).length;
				const close = (line.match(/}/g) ?? []).length;
				braceDepth += open - close;
			}
			continue;
		}

		const openBraces = (line.match(/{/g) ?? []).length;
		const closeBraces = (line.match(/}/g) ?? []).length;
		braceDepth += openBraces - closeBraces;

		if (braceDepth <= 0) {
			break;
		}

		const trimmed = line.trim();

		if (trimmed.startsWith('//')) {
			const text = trimmed.replace(/^\/\/\s?/, '').trim();
			if (text) {
				pending.push(text);
			}
			continue;
		}

		const match = trimmed.match(/^"([^"]+)"\s*:/);
		if (match) {
			const name = match[1];
			const note = pending.join('\n').trim();
			if (note) {
				notes[name] = note;
			}
			pending = [];
			continue;
		}

		if (trimmed) {
			pending = [];
		}
	}

	return notes;
}

function addHostToPolicy(
	policy: string,
	input: {
		name: string;
		address: string;
		note: string;
	},
): string | null {
	if (!policy || !policy.trim()) {
		return null;
	}

	if (!/"hosts"\s*:\s*{/.test(policy)) {
		return null;
	}

	const lines = policy.split(/\r?\n/);

	let hostsStart = -1;
	let inHosts = false;
	let braceDepth = 0;
	let hostsEnd = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (!inHosts) {
			if (/"hosts"\s*:\s*{/.test(line)) {
				inHosts = true;
				hostsStart = i;
				const open = (line.match(/{/g) ?? []).length;
				const close = (line.match(/}/g) ?? []).length;
				braceDepth += open - close;

				if (braceDepth <= 0) {
					hostsEnd = i;
					break;
				}
			}
			continue;
		}

		const openBraces = (line.match(/{/g) ?? []).length;
		const closeBraces = (line.match(/}/g) ?? []).length;
		braceDepth += openBraces - closeBraces;

		if (braceDepth <= 0) {
			hostsEnd = i;
			break;
		}
	}

	if (hostsStart === -1 || hostsEnd === -1) {
		return null;
	}

	let entryIndent = '';
	let hasExistingHosts = false;

	for (let i = hostsStart + 1; i < hostsEnd; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		if (!trimmed || trimmed.startsWith('//')) {
			continue;
		}

		if (/^"[^"]+"\s*:/.test(trimmed)) {
			hasExistingHosts = true;
			entryIndent = line.slice(0, line.indexOf(trimmed));
			break;
		}
	}

	if (!entryIndent) {
		const hostsLine = lines[hostsStart];
		const match = /^(\s*)/.exec(hostsLine);
		const baseIndent = match ? match[1] : '';
		entryIndent = `${baseIndent}  `;
	}

	const name = input.name.trim();
	const address = input.address.trim();
	if (!name || !address) {
		return null;
	}

	const newLines: string[] = [];

	if (input.note && input.note.trim()) {
		for (const rawLine of input.note.split('\n')) {
			const trimmed = rawLine.trim();
			if (!trimmed) {
				continue;
			}
			newLines.push(`${entryIndent}// ${trimmed}`);
		}
	}

	const propLine = `${entryIndent}${JSON.stringify(name)}: ${JSON.stringify(address)}`;
	newLines.push(propLine);

	if (hasExistingHosts && newLines.length > 0) {
		// Instead of rewriting the previous host line, insert a standalone comma
		// line before the new host block. In JSON/HuJSON the comma token belongs
		// to the previous entry and can legally appear on its own line.
		const commaIndent = entryIndent;
		newLines.unshift(`${commaIndent},`);
	}

	const before = lines.slice(0, hostsEnd);
	const after = lines.slice(hostsEnd);

	const insertion: string[] = [];
	insertion.push(...newLines);

	const resultLines = [...before, ...insertion, ...after];

	return resultLines.join('\n');
}

function updateHostInPolicy(
	policy: string,
	originalName: string,
	input: {
		name: string;
		address: string;
		note: string;
	},
): string | null {
	if (!policy || !policy.trim() || !/"hosts"\s*:\s*{/.test(policy)) {
		return null;
	}

	const lines = policy.split(/\r?\n/);

	let hostsStart = -1;
	let inHosts = false;
	let braceDepth = 0;
	let hostsEnd = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (!inHosts) {
			if (/"hosts"\s*:\s*{/.test(line)) {
				inHosts = true;
				hostsStart = i;
				const open = (line.match(/{/g) ?? []).length;
				const close = (line.match(/}/g) ?? []).length;
				braceDepth += open - close;
			}
			continue;
		}

		const openBraces = (line.match(/{/g) ?? []).length;
		const closeBraces = (line.match(/}/g) ?? []).length;
		braceDepth += openBraces - closeBraces;

		if (braceDepth <= 0) {
			hostsEnd = i;
			break;
		}
	}

	if (hostsStart === -1 || hostsEnd === -1) {
		return null;
	}

	let targetStart = -1;
	let targetEnd = -1;
	let commentStart: number | null = null;
	let propLineIndex = -1;

	for (let i = hostsStart + 1; i < hostsEnd; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		if (!trimmed) {
			continue;
		}

		if (trimmed.startsWith('//')) {
			if (commentStart === null) {
				commentStart = i;
			}
			continue;
		}

		const match = trimmed.match(/^"([^"]+)"\s*:/);
		if (match) {
			const name = match[1];

			const start = commentStart ?? i;
			let end = i;

			const trimmedEnd = lines[end].trim();
			if (!trimmedEnd.endsWith(',')) {
				let j = end + 1;
				while (j < hostsEnd && lines[j].trim() === '') {
					j++;
				}
				if (j < hostsEnd && lines[j].trim() === ',') {
					end = j;
				}
			}

			if (name === originalName) {
				targetStart = start;
				targetEnd = end;
				propLineIndex = i;
				break;
			}

			commentStart = null;
			continue;
		}

		commentStart = null;
	}

	if (targetStart === -1 || targetEnd === -1 || propLineIndex === -1) {
		return null;
	}

	const name = input.name.trim();
	const address = input.address.trim();
	if (!name || !address) {
		return null;
	}

	const propLine = lines[propLineIndex];
	const trimmedProp = propLine.trim();
	const entryIndent = propLine.slice(0, propLine.indexOf(trimmedProp)) || '';

	const replacementCore: string[] = [];

	if (input.note && input.note.trim()) {
		for (const rawLine of input.note.split('\n')) {
			const trimmed = rawLine.trim();
			if (!trimmed) {
				continue;
			}
			replacementCore.push(`${entryIndent}// ${trimmed}`);
		}
	}

	const newPropLine = `${entryIndent}${JSON.stringify(name)}: ${JSON.stringify(
		address,
	)}`;
	replacementCore.push(newPropLine);

	let hasCommaSeparateLine = false;
	let commaLineIndent = '';
	let hasCommaOnLine = false;

	for (let i = targetEnd; i >= targetStart; i--) {
		const line = lines[i];
		const trimmed = line.trim();
		if (!trimmed) {
			continue;
		}

		if (trimmed === ',') {
			hasCommaSeparateLine = true;
			const indentMatch = /^(\s*)/.exec(line);
			commaLineIndent = indentMatch ? indentMatch[1] : '';
			break;
		}

		if (trimmed.endsWith(',') && trimmed !== ',') {
			hasCommaOnLine = true;
			break;
		}

		if (trimmed.startsWith('//')) {
			break;
		}
	}

	const replacement: string[] = [];

	if (hasCommaSeparateLine) {
		replacement.push(...replacementCore);
		replacement.push(`${commaLineIndent},`);
	} else if (hasCommaOnLine) {
		const coreCopy = [...replacementCore];
		let lastNonEmpty = coreCopy.length - 1;
		while (lastNonEmpty >= 0 && coreCopy[lastNonEmpty].trim() === '') {
			lastNonEmpty--;
		}
		for (let i = lastNonEmpty; i >= 0; i--) {
			const line = coreCopy[i];
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('//')) {
				continue;
			}
			if (trimmed.endsWith('"')) {
				const match = /(.*\S)(\s*)$/.exec(line);
				if (match) {
					coreCopy[i] = `${match[1]},${match[2]}`;
				} else {
					coreCopy[i] = `${trimmed},`;
				}
				break;
			}
		}
		replacement.push(...coreCopy);
	} else {
		replacement.push(...replacementCore);
	}

	const nextLines = [
		...lines.slice(0, targetStart),
		...replacement,
		...lines.slice(targetEnd + 1),
	];

	return nextLines.join('\n');
}

function deleteHostFromPolicy(policy: string, name: string): string | null {
	if (!policy || !policy.trim() || !/"hosts"\s*:\s*{/.test(policy)) {
		return null;
	}

	const lines = policy.split(/\r?\n/);

	let hostsStart = -1;
	let inHosts = false;
	let braceDepth = 0;
	let hostsEnd = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (!inHosts) {
			if (/"hosts"\s*:\s*{/.test(line)) {
				inHosts = true;
				hostsStart = i;
				const open = (line.match(/{/g) ?? []).length;
				const close = (line.match(/}/g) ?? []).length;
				braceDepth += open - close;
			}
			continue;
		}

		const openBraces = (line.match(/{/g) ?? []).length;
		const closeBraces = (line.match(/}/g) ?? []).length;
		braceDepth += openBraces - closeBraces;

		if (braceDepth <= 0) {
			hostsEnd = i;
			break;
		}
	}

	if (hostsStart === -1 || hostsEnd === -1) {
		return null;
	}

	const entries: { name: string; start: number; end: number }[] = [];
	let commentStart: number | null = null;

	for (let i = hostsStart + 1; i < hostsEnd; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		if (!trimmed) {
			continue;
		}

		if (trimmed.startsWith('//')) {
			if (commentStart === null) {
				commentStart = i;
			}
			continue;
		}

		const match = trimmed.match(/^"([^"]+)"\s*:/);
		if (match) {
			const hostName = match[1];

			const start = commentStart ?? i;
			let end = i;

			const trimmedEnd = lines[end].trim();
			if (!trimmedEnd.endsWith(',')) {
				let j = end + 1;
				while (j < hostsEnd && lines[j].trim() === '') {
					j++;
				}
				if (j < hostsEnd && lines[j].trim() === ',') {
					end = j;
				}
			}

			entries.push({ name: hostName, start, end });
			commentStart = null;
			continue;
		}

		commentStart = null;
	}

	const target = entries.find((entry) => entry.name === name);
	if (!target) {
		return null;
	}

	const nextLines = [
		...lines.slice(0, target.start),
		...lines.slice(target.end + 1),
	];

	return nextLines.join('\n');
}

function extractGroupNotes(policy: string): Record<string, string> {
	const lines = policy.split(/\r?\n/);
	const notes: Record<string, string> = {};
	let inGroups = false;
	let braceDepth = 0;
	let pending: string[] = [];

	for (const rawLine of lines) {
		const line = rawLine;

		if (!inGroups) {
			if (/"groups"\s*:\s*{/.test(line)) {
				inGroups = true;
				const open = (line.match(/{/g) ?? []).length;
				const close = (line.match(/}/g) ?? []).length;
				braceDepth += open - close;
			}
			continue;
		}

		const openBraces = (line.match(/{/g) ?? []).length;
		const closeBraces = (line.match(/}/g) ?? []).length;
		braceDepth += openBraces - closeBraces;

		if (braceDepth <= 0) {
			break;
		}

		const trimmed = line.trim();

		if (trimmed.startsWith('//')) {
			const text = trimmed.replace(/^\/\/\s?/, '').trim();
			if (text) {
				pending.push(text);
			}
			continue;
		}

		const match = trimmed.match(/^"([^"]+)"\s*:/);
		if (match) {
			const groupName = match[1];
			const note = pending.join('\n').trim();
			if (note) {
				notes[groupName] = note;
			}
			pending = [];
			continue;
		}

		if (trimmed) {
			pending = [];
		}
	}

	return notes;
}

function addGroupToPolicy(
	policy: string,
	input: {
		groupName: string;
		members: string;
		note: string;
	},
): string | null {
	if (!policy || !policy.trim()) {
		return null;
	}

	if (!/"groups"\s*:\s*{/.test(policy)) {
		return null;
	}

	const lines = policy.split(/\r?\n/);

	let groupsStart = -1;
	let inGroups = false;
	let braceDepth = 0;
	let groupsEnd = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (!inGroups) {
			if (/"groups"\s*:\s*{/.test(line)) {
				inGroups = true;
				groupsStart = i;
				const open = (line.match(/{/g) ?? []).length;
				const close = (line.match(/}/g) ?? []).length;
				braceDepth += open - close;

				if (braceDepth <= 0) {
					groupsEnd = i;
					break;
				}
			}
			continue;
		}

		const openBraces = (line.match(/{/g) ?? []).length;
		const closeBraces = (line.match(/}/g) ?? []).length;
		braceDepth += openBraces - closeBraces;

		if (braceDepth <= 0) {
			groupsEnd = i;
			break;
		}
	}

	if (groupsStart === -1 || groupsEnd === -1) {
		return null;
	}

	let entryIndent = '';
	let hasExistingEntries = false;

	for (let i = groupsStart + 1; i < groupsEnd; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		if (!trimmed || trimmed.startsWith('//')) {
			continue;
		}

		if (/^"[^"]+"\s*:/.test(trimmed)) {
			hasExistingEntries = true;
			entryIndent = line.slice(0, line.indexOf(trimmed));
			break;
		}
	}

	if (!entryIndent) {
		const line = lines[groupsStart];
		const match = /^(\s*)/.exec(line);
		const baseIndent = match ? match[1] : '';
		entryIndent = `${baseIndent}  `;
	}

	// If there are existing entries, ensure the previous entry line ends with
	// a comma so that the new group can be appended without introducing a
	// standalone comma-only line, which can lead to awkward HuJSON formatting.
	if (hasExistingEntries) {
		for (let i = groupsEnd - 1; i > groupsStart; i--) {
			const candidate = lines[i];
			const trimmedCandidate = candidate.trim();
			if (!trimmedCandidate || trimmedCandidate.startsWith('//')) {
				continue;
			}

			if (!trimmedCandidate.endsWith(',')) {
				const match = /(.*\S)(\s*)$/.exec(candidate);
				if (match) {
					lines[i] = `${match[1]},${match[2]}`;
				} else {
					lines[i] = `${trimmedCandidate},`;
				}
			}
			break;
		}
	}

	const groupName = input.groupName.trim();
	const membersRaw = input.members.trim();
	if (!groupName || !membersRaw) {
		return null;
	}

	const membersList = membersRaw
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);

	if (membersList.length === 0) {
		return null;
	}

	const newLines: string[] = [];

	if (input.note && input.note.trim()) {
		for (const rawLine of input.note.split('\n')) {
			const trimmed = rawLine.trim();
			if (!trimmed) {
				continue;
			}
			newLines.push(`${entryIndent}// ${trimmed}`);
		}
	}

	const propLine = `${entryIndent}${JSON.stringify(
		groupName,
	)}: ${JSON.stringify(membersList)}`;
	newLines.push(propLine);

	const before = lines.slice(0, groupsEnd);
	const after = lines.slice(groupsEnd);

	const insertion: string[] = [];
	insertion.push(...newLines);

	const resultLines = [...before, ...insertion, ...after];

	const nextPolicy = resultLines.join('\n');

	// Normalize the "groups" object formatting using the same logic as
	// `reorderGroupsInPolicy`, but keep the existing order of groups.
	try {
		const normalizedPolicy = nextPolicy
			.replace(/\/\/.*$/gm, '')
			.replace(/,(\s*[}\]])/g, '$1');

		const parsed = JSON.parse(normalizedPolicy) as {
			groups?: Record<string, unknown>;
		};

		if (parsed.groups && typeof parsed.groups === 'object') {
			const entries = Object.entries(parsed.groups);
			const orderedGroupIds = entries.map((_, idx) => idx);
			const reordered = reorderGroupsInPolicy(nextPolicy, orderedGroupIds);
			if (reordered) {
				return reordered;
			}
		}
		// Fall through to returning nextPolicy if normalization fails.
	} catch {
		// If anything goes wrong, just return the minimally edited policy.
	}

	return nextPolicy;
}

function updateGroupInPolicy(
	policy: string,
	originalGroupName: string,
	input: {
		groupName: string;
		members: string;
		note: string;
	},
): string | null {
	if (!policy || !policy.trim() || !/"groups"\s*:\s*{/.test(policy)) {
		return null;
	}

	const lines = policy.split(/\r?\n/);

	let groupsStart = -1;
	let inGroups = false;
	let braceDepth = 0;
	let groupsEnd = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (!inGroups) {
			if (/"groups"\s*:\s*{/.test(line)) {
				inGroups = true;
				groupsStart = i;
				const open = (line.match(/{/g) ?? []).length;
				const close = (line.match(/}/g) ?? []).length;
				braceDepth += open - close;
			}
			continue;
		}

		const openBraces = (line.match(/{/g) ?? []).length;
		const closeBraces = (line.match(/}/g) ?? []).length;
		braceDepth += openBraces - closeBraces;

		if (braceDepth <= 0) {
			groupsEnd = i;
			break;
		}
	}

	if (groupsStart === -1 || groupsEnd === -1) {
		return null;
	}

	let targetStart = -1;
	let targetEnd = -1;
	let commentStart: number | null = null;
	let propLineIndex = -1;

	for (let i = groupsStart + 1; i < groupsEnd; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		if (!trimmed) {
			continue;
		}

		if (trimmed.startsWith('//')) {
			if (commentStart === null) {
				commentStart = i;
			}
			continue;
		}

		const match = trimmed.match(/^"([^"]+)"\s*:/);
		if (match) {
			const currentGroupName = match[1];

			const start = commentStart ?? i;
			let end = i;

			const trimmedEnd = lines[end].trim();
			if (!trimmedEnd.endsWith(',')) {
				let j = end + 1;
				while (j < groupsEnd && lines[j].trim() === '') {
					j++;
				}
				if (j < groupsEnd && lines[j].trim() === ',') {
					end = j;
				}
			}

			if (currentGroupName === originalGroupName) {
				targetStart = start;
				targetEnd = end;
				propLineIndex = i;
				break;
			}

			commentStart = null;
			continue;
		}

		commentStart = null;
	}

	if (targetStart === -1 || targetEnd === -1 || propLineIndex === -1) {
		return null;
	}

	const groupName = input.groupName.trim();
	const membersRaw = input.members.trim();
	if (!groupName || !membersRaw) {
		return null;
	}

	const membersList = membersRaw
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);

	if (membersList.length === 0) {
		return null;
	}

	const propLine = lines[propLineIndex];
	const trimmedProp = propLine.trim();
	const entryIndent = propLine.slice(0, propLine.indexOf(trimmedProp)) || '';

	const replacementCore: string[] = [];

	if (input.note && input.note.trim()) {
		for (const rawLine of input.note.split('\n')) {
			const trimmed = rawLine.trim();
			if (!trimmed) {
				continue;
			}
			replacementCore.push(`${entryIndent}// ${trimmed}`);
		}
	}

	const newPropLine = `${entryIndent}${JSON.stringify(
		groupName,
	)}: ${JSON.stringify(membersList)}`;
	replacementCore.push(newPropLine);

	let hasCommaSeparateLine = false;
	let commaLineIndent = '';
	let hasCommaOnLine = false;

	for (let i = targetEnd; i >= targetStart; i--) {
		const line = lines[i];
		const trimmed = line.trim();
		if (!trimmed) {
			continue;
		}

		if (trimmed === ',') {
			hasCommaSeparateLine = true;
			const indentMatch = /^(\s*)/.exec(line);
			commaLineIndent = indentMatch ? indentMatch[1] : '';
			break;
		}

		if (trimmed.endsWith(',') && trimmed !== ',') {
			hasCommaOnLine = true;
			break;
		}

		if (trimmed.startsWith('//')) {
			break;
		}
	}

	const replacement: string[] = [];

	if (hasCommaSeparateLine) {
		replacement.push(...replacementCore);
		replacement.push(`${commaLineIndent},`);
	} else if (hasCommaOnLine) {
		const coreCopy = [...replacementCore];
		let lastNonEmpty = coreCopy.length - 1;
		while (lastNonEmpty >= 0 && coreCopy[lastNonEmpty].trim() === '') {
			lastNonEmpty--;
		}
		for (let i = lastNonEmpty; i >= 0; i--) {
			const line = coreCopy[i];
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('//')) {
				continue;
			}
			const match = /(.*\S)(\s*)$/.exec(line);
			if (match) {
				coreCopy[i] = `${match[1]},${match[2]}`;
			} else {
				coreCopy[i] = `${trimmed},`;
			}
			break;
		}
		replacement.push(...coreCopy);
	} else {
		replacement.push(...replacementCore);
	}

	const nextLines = [
		...lines.slice(0, targetStart),
		...replacement,
		...lines.slice(targetEnd + 1),
	];

	const nextPolicy = nextLines.join('\n');

	// After updating a group, normalize the "groups" object formatting
	// so it matches the canonical HuJSON style used elsewhere.
	try {
		const normalizedPolicy = nextPolicy
			.replace(/\/\/.*$/gm, '')
			.replace(/,(\s*[}\]])/g, '$1');

		const parsed = JSON.parse(normalizedPolicy) as {
			groups?: Record<string, unknown>;
		};

		if (parsed.groups && typeof parsed.groups === 'object') {
			const entries = Object.entries(parsed.groups);
			const orderedGroupIds = entries.map((_, idx) => idx);
			const reordered = reorderGroupsInPolicy(nextPolicy, orderedGroupIds);
			if (reordered) {
				return reordered;
			}
		}
	} catch {
		// Ignore normalization errors and return the minimally edited policy.
	}

	return nextPolicy;
}

function deleteGroupFromPolicy(
	policy: string,
	groupName: string,
): string | null {
	if (!policy || !policy.trim() || !/"groups"\s*:\s*{/.test(policy)) {
		return null;
	}

	const lines = policy.split(/\r?\n/);

	let groupsStart = -1;
	let inGroups = false;
	let braceDepth = 0;
	let groupsEnd = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (!inGroups) {
			if (/"groups"\s*:\s*{/.test(line)) {
				inGroups = true;
				groupsStart = i;
				const open = (line.match(/{/g) ?? []).length;
				const close = (line.match(/}/g) ?? []).length;
				braceDepth += open - close;
			}
			continue;
		}

		const openBraces = (line.match(/{/g) ?? []).length;
		const closeBraces = (line.match(/}/g) ?? []).length;
		braceDepth += openBraces - closeBraces;

		if (braceDepth <= 0) {
			groupsEnd = i;
			break;
		}
	}

	if (groupsStart === -1 || groupsEnd === -1) {
		return null;
	}

	const entries: { groupName: string; start: number; end: number }[] = [];
	let commentStart: number | null = null;

	for (let i = groupsStart + 1; i < groupsEnd; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		if (!trimmed) {
			continue;
		}

		if (trimmed.startsWith('//')) {
			if (commentStart === null) {
				commentStart = i;
			}
			continue;
		}

		const match = trimmed.match(/^"([^"]+)"\s*:/);
		if (match) {
			const currentGroupName = match[1];

			const start = commentStart ?? i;
			let end = i;

			const trimmedEnd = lines[end].trim();
			if (!trimmedEnd.endsWith(',')) {
				let j = end + 1;
				while (j < groupsEnd && lines[j].trim() === '') {
					j++;
				}
				if (j < groupsEnd && lines[j].trim() === ',') {
					end = j;
				}
			}

			entries.push({ groupName: currentGroupName, start, end });
			commentStart = null;
			continue;
		}

		commentStart = null;
	}

	const target = entries.find((entry) => entry.groupName === groupName);
	if (!target) {
		return null;
	}

	const nextLines = [
		...lines.slice(0, target.start),
		...lines.slice(target.end + 1),
	];

	return nextLines.join('\n');
}

function reorderGroupsInPolicy(
	policy: string,
	orderedGroupIds: number[],
): string | null {
	if (!policy || !policy.trim()) {
		return null;
	}

	if (!/"groups"\s*:\s*{/.test(policy)) {
		return null;
	}

	let parsedGroups: Record<string, unknown> | null = null;
	try {
		const normalizedPolicy = policy
			.replace(/\/\/.*$/gm, '')
			.replace(/,(\s*[}\]])/g, '$1');

		const parsed = JSON.parse(normalizedPolicy) as {
			groups?: Record<string, unknown>;
		};

		if (!parsed.groups || typeof parsed.groups !== 'object') {
			return null;
		}

		parsedGroups = parsed.groups as Record<string, unknown>;
	} catch {
		return null;
	}

	const entries = Object.entries(parsedGroups);
	if (entries.length === 0) {
		return null;
	}

	const order = orderedGroupIds
		.map((idx) =>
			Number.isNaN(idx) || idx < 0 || idx >= entries.length ? null : idx,
		)
		.filter((idx): idx is number => idx !== null);

	if (order.length === 0) {
		return null;
	}

	const reorderedEntries = order.map((idx) => entries[idx]);

	const notes = extractGroupNotes(policy);

	const lines = policy.split(/\r?\n/);

	let groupsStart = -1;
	let inGroups = false;
	let braceDepth = 0;
	let groupsEnd = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (!inGroups) {
			if (/"groups"\s*:\s*{/.test(line)) {
				inGroups = true;
				groupsStart = i;
				const open = (line.match(/{/g) ?? []).length;
				const close = (line.match(/}/g) ?? []).length;
				braceDepth += open - close;
			}
			continue;
		}

		const openBraces = (line.match(/{/g) ?? []).length;
		const closeBraces = (line.match(/}/g) ?? []).length;
		braceDepth += openBraces - closeBraces;

		if (braceDepth <= 0) {
			groupsEnd = i;
			break;
		}
	}

	if (groupsStart === -1 || groupsEnd === -1) {
		return null;
	}

	const headerLine = lines[groupsStart];
	const footerLine = lines[groupsEnd];

	const headerIndentMatch = /^(\s*)/.exec(headerLine);
	const baseIndent = headerIndentMatch ? headerIndentMatch[1] : '';
	const entryIndent = `${baseIndent}  `;

	const bodyLines: string[] = [];

	const regionLines = lines.slice(groupsStart + 1, groupsEnd);
	let prefixEnd = -1;
	for (let i = 0; i < regionLines.length; i++) {
		const trimmed = regionLines[i].trim();
		if (!trimmed || trimmed.startsWith('//')) {
			prefixEnd = i;
			continue;
		}
		if (/^"([^"]+)"\s*:/.test(trimmed)) {
			break;
		}
		prefixEnd = i;
	}
	if (prefixEnd >= 0) {
		for (let i = 0; i <= prefixEnd; i++) {
			bodyLines.push(regionLines[i]);
		}
	}

	reorderedEntries.forEach(([groupName, membersValue], idx) => {
		const isLast = idx === reorderedEntries.length - 1;

		const membersArray: string[] = [];
		if (Array.isArray(membersValue)) {
			membersValue.forEach((v) => {
				membersArray.push(String(v));
			});
		} else if (typeof membersValue === 'string') {
			membersArray.push(membersValue);
		} else if (membersValue != null) {
			membersArray.push(JSON.stringify(membersValue));
		}

		const entryLines: string[] = [];

		const note = notes[groupName];
		if (note && note.trim()) {
			for (const raw of note.split('\n')) {
				const t = raw.trim();
				if (!t) continue;
				entryLines.push(`${entryIndent}// ${t}`);
			}
		}

		if (membersArray.length === 0) {
			entryLines.push(`${entryIndent}${JSON.stringify(groupName)}: []`);
		} else if (membersArray.length === 1) {
			entryLines.push(
				`${entryIndent}${JSON.stringify(groupName)}: [${JSON.stringify(
					membersArray[0],
				)}]`,
			);
		} else {
			entryLines.push(`${entryIndent}${JSON.stringify(groupName)}: [`);
			membersArray.forEach((member, memberIndex) => {
				const isLastMember = memberIndex === membersArray.length - 1;
				const comma = isLastMember ? '' : ',';
				entryLines.push(`${entryIndent}  ${JSON.stringify(member)}${comma}`);
			});
			entryLines.push(`${entryIndent}]`);
		}

		if (!isLast) {
			let lastIdx = entryLines.length - 1;
			while (lastIdx >= 0 && entryLines[lastIdx].trim() === '') {
				lastIdx--;
			}
			if (lastIdx >= 0) {
				const line = entryLines[lastIdx];
				const match = /(.*\S)(\s*)$/.exec(line);
				if (match) {
					entryLines[lastIdx] = `${match[1]},${match[2]}`;
				} else {
					entryLines[lastIdx] = `${line.trimEnd()},`;
				}
			}
		}

		bodyLines.push(...entryLines);
	});

	const before = lines.slice(0, groupsStart);
	const after = lines.slice(groupsEnd + 1);

	const resultLines = [
		...before,
		headerLine,
		...bodyLines,
		footerLine,
		...after,
	];

	return resultLines.join('\n');
}

function extractTagOwnerNotes(policy: string): Record<string, string> {
	const lines = policy.split(/\r?\n/);
	const notes: Record<string, string> = {};
	let inTagOwners = false;
	let braceDepth = 0;
	let pending: string[] = [];

	for (const rawLine of lines) {
		const line = rawLine;

		if (!inTagOwners) {
			if (/"tagOwners"\s*:\s*{/.test(line)) {
				inTagOwners = true;
				const open = (line.match(/{/g) ?? []).length;
				const close = (line.match(/}/g) ?? []).length;
				braceDepth += open - close;
			}
			continue;
		}

		const openBraces = (line.match(/{/g) ?? []).length;
		const closeBraces = (line.match(/}/g) ?? []).length;
		braceDepth += openBraces - closeBraces;

		if (braceDepth <= 0) {
			break;
		}

		const trimmed = line.trim();

		if (trimmed.startsWith('//')) {
			const text = trimmed.replace(/^\/\/\s?/, '').trim();
			if (text) {
				pending.push(text);
			}
			continue;
		}

		const match = trimmed.match(/^"([^"]+)"\s*:/);
		if (match) {
			const tagName = match[1];
			const note = pending.join('\n').trim();
			if (note) {
				notes[tagName] = note;
			}
			pending = [];
			continue;
		}

		if (trimmed) {
			pending = [];
		}
	}

	return notes;
}

function addTagOwnerToPolicy(
	policy: string,
	input: {
		tagName: string;
		owners: string;
		note: string;
	},
): string | null {
	if (!policy || !policy.trim()) {
		return null;
	}

	if (!/"tagOwners"\s*:\s*{/.test(policy)) {
		return null;
	}

	const lines = policy.split(/\r?\n/);

	let tagOwnersStart = -1;
	let inTagOwners = false;
	let braceDepth = 0;
	let tagOwnersEnd = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (!inTagOwners) {
			if (/"tagOwners"\s*:\s*{/.test(line)) {
				inTagOwners = true;
				tagOwnersStart = i;
				const open = (line.match(/{/g) ?? []).length;
				const close = (line.match(/}/g) ?? []).length;
				braceDepth += open - close;

				if (braceDepth <= 0) {
					tagOwnersEnd = i;
					break;
				}
			}
			continue;
		}

		const openBraces = (line.match(/{/g) ?? []).length;
		const closeBraces = (line.match(/}/g) ?? []).length;
		braceDepth += openBraces - closeBraces;

		if (braceDepth <= 0) {
			tagOwnersEnd = i;
			break;
		}
	}

	if (tagOwnersStart === -1 || tagOwnersEnd === -1) {
		return null;
	}

	let entryIndent = '';
	let hasExistingEntries = false;

	for (let i = tagOwnersStart + 1; i < tagOwnersEnd; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		if (!trimmed || trimmed.startsWith('//')) {
			continue;
		}

		if (/^"[^"]+"\s*:/.test(trimmed)) {
			hasExistingEntries = true;
			entryIndent = line.slice(0, line.indexOf(trimmed));
			break;
		}
	}

	if (!entryIndent) {
		const line = lines[tagOwnersStart];
		const match = /^(\s*)/.exec(line);
		const baseIndent = match ? match[1] : '';
		entryIndent = `${baseIndent}  `;
	}

	const tagName = input.tagName.trim();
	const ownersRaw = input.owners.trim();
	if (!tagName || !ownersRaw) {
		return null;
	}

	const ownersList = ownersRaw
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);

	if (ownersList.length === 0) {
		return null;
	}

	const newLines: string[] = [];

	if (input.note && input.note.trim()) {
		for (const rawLine of input.note.split('\n')) {
			const trimmed = rawLine.trim();
			if (!trimmed) {
				continue;
			}
			newLines.push(`${entryIndent}// ${trimmed}`);
		}
	}

	const propLine = `${entryIndent}${JSON.stringify(
		tagName,
	)}: ${JSON.stringify(ownersList)}`;
	newLines.push(propLine);

	if (hasExistingEntries && newLines.length > 0) {
		const commaIndent = entryIndent;
		newLines.unshift('');
		newLines.unshift(`${commaIndent},`);
	}

	const before = lines.slice(0, tagOwnersEnd);
	const after = lines.slice(tagOwnersEnd);

	const insertion: string[] = [];
	insertion.push(...newLines);

	const resultLines = [...before, ...insertion, ...after];

	const nextPolicy = resultLines.join('\n');

	// Normalize the "tagOwners" object formatting using the same logic as
	// `reorderTagOwnersInPolicy`, but keep the existing order of tag owners.
	try {
		const normalizedPolicy = nextPolicy
			.replace(/\/\/.*$/gm, '')
			.replace(/,(\s*[}\]])/g, '$1');

		const parsed = JSON.parse(normalizedPolicy) as {
			tagOwners?: Record<string, unknown>;
		};

		if (parsed.tagOwners && typeof parsed.tagOwners === 'object') {
			const entries = Object.entries(parsed.tagOwners);
			const orderedTagOwnerIds = entries.map((_, idx) => idx);
			const reordered = reorderTagOwnersInPolicy(
				nextPolicy,
				orderedTagOwnerIds,
			);
			if (reordered) {
				return reordered;
			}
		}
		// Fall through to returning nextPolicy if normalization fails.
	} catch {
		// If anything goes wrong, just return the minimally edited policy.
	}

	return nextPolicy;
}

function updateTagOwnerInPolicy(
	policy: string,
	originalTagName: string,
	input: {
		tagName: string;
		owners: string;
		note: string;
	},
): string | null {
	if (!policy || !policy.trim() || !/"tagOwners"\s*:\s*{/.test(policy)) {
		return null;
	}

	const lines = policy.split(/\r?\n/);

	let tagOwnersStart = -1;
	let inTagOwners = false;
	let braceDepth = 0;
	let tagOwnersEnd = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (!inTagOwners) {
			if (/"tagOwners"\s*:\s*{/.test(line)) {
				inTagOwners = true;
				tagOwnersStart = i;
				const open = (line.match(/{/g) ?? []).length;
				const close = (line.match(/}/g) ?? []).length;
				braceDepth += open - close;
			}
			continue;
		}

		const openBraces = (line.match(/{/g) ?? []).length;
		const closeBraces = (line.match(/}/g) ?? []).length;
		braceDepth += openBraces - closeBraces;

		if (braceDepth <= 0) {
			tagOwnersEnd = i;
			break;
		}
	}

	if (tagOwnersStart === -1 || tagOwnersEnd === -1) {
		return null;
	}

	let targetStart = -1;
	let targetEnd = -1;
	let commentStart: number | null = null;
	let propLineIndex = -1;

	for (let i = tagOwnersStart + 1; i < tagOwnersEnd; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		if (!trimmed) {
			continue;
		}

		if (trimmed.startsWith('//')) {
			if (commentStart === null) {
				commentStart = i;
			}
			continue;
		}

		const match = trimmed.match(/^"([^"]+)"\s*:/);
		if (match) {
			const tagName = match[1];

			const start = commentStart ?? i;
			let end = i;

			const trimmedEnd = lines[end].trim();
			if (!trimmedEnd.endsWith(',')) {
				let j = end + 1;
				while (j < tagOwnersEnd && lines[j].trim() === '') {
					j++;
				}
				if (j < tagOwnersEnd && lines[j].trim() === ',') {
					end = j;
				}
			}

			if (tagName === originalTagName) {
				targetStart = start;
				targetEnd = end;
				propLineIndex = i;
				break;
			}

			commentStart = null;
			continue;
		}

		commentStart = null;
	}

	if (targetStart === -1 || targetEnd === -1 || propLineIndex === -1) {
		return null;
	}

	const tagName = input.tagName.trim();
	const ownersRaw = input.owners.trim();
	if (!tagName || !ownersRaw) {
		return null;
	}

	const ownersList = ownersRaw
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);

	if (ownersList.length === 0) {
		return null;
	}

	const propLine = lines[propLineIndex];
	const trimmedProp = propLine.trim();
	const entryIndent = propLine.slice(0, propLine.indexOf(trimmedProp)) || '';

	const replacementCore: string[] = [];

	if (input.note && input.note.trim()) {
		for (const rawLine of input.note.split('\n')) {
			const trimmed = rawLine.trim();
			if (!trimmed) {
				continue;
			}
			replacementCore.push(`${entryIndent}// ${trimmed}`);
		}
	}

	const newPropLine = `${entryIndent}${JSON.stringify(
		tagName,
	)}: ${JSON.stringify(ownersList)}`;
	replacementCore.push(newPropLine);

	let hasCommaSeparateLine = false;
	let commaLineIndent = '';
	let hasCommaOnLine = false;

	for (let i = targetEnd; i >= targetStart; i--) {
		const line = lines[i];
		const trimmed = line.trim();
		if (!trimmed) {
			continue;
		}

		if (trimmed === ',') {
			hasCommaSeparateLine = true;
			const indentMatch = /^(\s*)/.exec(line);
			commaLineIndent = indentMatch ? indentMatch[1] : '';
			break;
		}

		if (trimmed.endsWith(',') && trimmed !== ',') {
			hasCommaOnLine = true;
			break;
		}

		if (trimmed.startsWith('//')) {
			break;
		}
	}

	const replacement: string[] = [];

	if (hasCommaSeparateLine) {
		replacement.push(...replacementCore);
		replacement.push(`${commaLineIndent},`);
	} else if (hasCommaOnLine) {
		const coreCopy = [...replacementCore];
		let lastNonEmpty = coreCopy.length - 1;
		while (lastNonEmpty >= 0 && coreCopy[lastNonEmpty].trim() === '') {
			lastNonEmpty--;
		}
		for (let i = lastNonEmpty; i >= 0; i--) {
			const line = coreCopy[i];
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith('//')) {
				continue;
			}
			const match = /(.*\S)(\s*)$/.exec(line);
			if (match) {
				coreCopy[i] = `${match[1]},${match[2]}`;
			} else {
				coreCopy[i] = `${trimmed},`;
			}
			break;
		}
		replacement.push(...coreCopy);
	} else {
		replacement.push(...replacementCore);
	}

	const nextLines = [
		...lines.slice(0, targetStart),
		...replacement,
		...lines.slice(targetEnd + 1),
	];

	const nextPolicy = nextLines.join('\n');

	// After updating a tag owner, normalize the "tagOwners" object formatting
	// so it matches the canonical HuJSON style used elsewhere.
	try {
		const normalizedPolicy = nextPolicy
			.replace(/\/\/.*$/gm, '')
			.replace(/,(\s*[}\]])/g, '$1');

		const parsed = JSON.parse(normalizedPolicy) as {
			tagOwners?: Record<string, unknown>;
		};

		if (parsed.tagOwners && typeof parsed.tagOwners === 'object') {
			const entries = Object.entries(parsed.tagOwners);
			const orderedTagOwnerIds = entries.map((_, idx) => idx);
			const reordered = reorderTagOwnersInPolicy(
				nextPolicy,
				orderedTagOwnerIds,
			);
			if (reordered) {
				return reordered;
			}
		}
	} catch {
		// Ignore normalization errors and return the minimally edited policy.
	}

	return nextPolicy;
}

function deleteTagOwnerFromPolicy(
	policy: string,
	tagName: string,
): string | null {
	if (!policy || !policy.trim() || !/"tagOwners"\s*:\s*{/.test(policy)) {
		return null;
	}

	const lines = policy.split(/\r?\n/);

	let tagOwnersStart = -1;
	let inTagOwners = false;
	let braceDepth = 0;
	let tagOwnersEnd = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (!inTagOwners) {
			if (/"tagOwners"\s*:\s*{/.test(line)) {
				inTagOwners = true;
				tagOwnersStart = i;
				const open = (line.match(/{/g) ?? []).length;
				const close = (line.match(/}/g) ?? []).length;
				braceDepth += open - close;
			}
			continue;
		}

		const openBraces = (line.match(/{/g) ?? []).length;
		const closeBraces = (line.match(/}/g) ?? []).length;
		braceDepth += openBraces - closeBraces;

		if (braceDepth <= 0) {
			tagOwnersEnd = i;
			break;
		}
	}

	if (tagOwnersStart === -1 || tagOwnersEnd === -1) {
		return null;
	}

	const entries: { tagName: string; start: number; end: number }[] = [];
	let commentStart: number | null = null;

	for (let i = tagOwnersStart + 1; i < tagOwnersEnd; i++) {
		const line = lines[i];
		const trimmed = line.trim();

		if (!trimmed) {
			continue;
		}

		if (trimmed.startsWith('//')) {
			if (commentStart === null) {
				commentStart = i;
			}
			continue;
		}

		const match = trimmed.match(/^"([^"]+)"\s*:/);
		if (match) {
			const currentTagName = match[1];

			const start = commentStart ?? i;
			let end = i;

			const trimmedEnd = lines[end].trim();
			if (!trimmedEnd.endsWith(',')) {
				let j = end + 1;
				while (j < tagOwnersEnd && lines[j].trim() === '') {
					j++;
				}
				if (j < tagOwnersEnd && lines[j].trim() === ',') {
					end = j;
				}
			}

			entries.push({ tagName: currentTagName, start, end });
			commentStart = null;
			continue;
		}

		commentStart = null;
	}

	const target = entries.find((entry) => entry.tagName === tagName);
	if (!target) {
		return null;
	}

	const nextLines = [
		...lines.slice(0, target.start),
		...lines.slice(target.end + 1),
	];

	return nextLines.join('\n');
}

function reorderTagOwnersInPolicy(
	policy: string,
	orderedTagOwnerIds: number[],
): string | null {
	if (!policy || !policy.trim()) {
		return null;
	}

	if (!/"tagOwners"\s*:\s*{/.test(policy)) {
		return null;
	}

	// First, parse a normalized JSON view of tagOwners so we can get the
	// canonical list of keys and values in their current order.
	let parsedTagOwners: Record<string, unknown> | null = null;
	try {
		const normalizedPolicy = policy
			.replace(/\/\/.*$/gm, '')
			.replace(/,(\s*[}\]])/g, '$1');

		const parsed = JSON.parse(normalizedPolicy) as {
			tagOwners?: Record<string, unknown>;
		};

		if (!parsed.tagOwners || typeof parsed.tagOwners !== 'object') {
			return null;
		}

		parsedTagOwners = parsed.tagOwners as Record<string, unknown>;
	} catch {
		return null;
	}

	const entries = Object.entries(parsedTagOwners);
	if (entries.length === 0) {
		return null;
	}

	const order = orderedTagOwnerIds
		.map((idx) =>
			Number.isNaN(idx) || idx < 0 || idx >= entries.length ? null : idx,
		)
		.filter((idx): idx is number => idx !== null);

	if (order.length === 0) {
		return null;
	}

	const reorderedEntries = order.map((idx) => entries[idx]);

	// Extract per-tag notes from the original HuJSON so we can re-attach them
	// above each tag owner entry after reordering.
	const notes = extractTagOwnerNotes(policy);

	const lines = policy.split(/\r?\n/);

	// Locate the "tagOwners" object region in the original text.
	let tagOwnersStart = -1;
	let inTagOwners = false;
	let braceDepth = 0;
	let tagOwnersEnd = -1;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (!inTagOwners) {
			if (/"tagOwners"\s*:\s*{/.test(line)) {
				inTagOwners = true;
				tagOwnersStart = i;
				const open = (line.match(/{/g) ?? []).length;
				const close = (line.match(/}/g) ?? []).length;
				braceDepth += open - close;
			}
			continue;
		}

		const openBraces = (line.match(/{/g) ?? []).length;
		const closeBraces = (line.match(/}/g) ?? []).length;
		braceDepth += openBraces - closeBraces;

		if (braceDepth <= 0) {
			tagOwnersEnd = i;
			break;
		}
	}

	if (tagOwnersStart === -1 || tagOwnersEnd === -1) {
		return null;
	}

	const headerLine = lines[tagOwnersStart];
	const footerLine = lines[tagOwnersEnd];

	const headerIndentMatch = /^(\s*)/.exec(headerLine);
	const baseIndent = headerIndentMatch ? headerIndentMatch[1] : '';
	const entryIndent = `${baseIndent}  `;

	const bodyLines: string[] = [];

	// Preserve any leading comments/blank lines that appeared between the
	// "tagOwners" header line and the first property.
	const regionLines = lines.slice(tagOwnersStart + 1, tagOwnersEnd);
	let prefixEnd = -1;
	for (let i = 0; i < regionLines.length; i++) {
		const trimmed = regionLines[i].trim();
		if (!trimmed || trimmed.startsWith('//')) {
			prefixEnd = i;
			continue;
		}
		if (/^"([^"]+)"\s*:/.test(trimmed)) {
			break;
		}
		prefixEnd = i;
	}
	if (prefixEnd >= 0) {
		for (let i = 0; i <= prefixEnd; i++) {
			bodyLines.push(regionLines[i]);
		}
	}

	reorderedEntries.forEach(([tagName, ownersValue], idx) => {
		const isLast = idx === reorderedEntries.length - 1;

		const ownersArray: string[] = [];
		if (Array.isArray(ownersValue)) {
			ownersValue.forEach((v) => {
				ownersArray.push(String(v));
			});
		} else if (typeof ownersValue === 'string') {
			ownersArray.push(ownersValue);
		} else if (ownersValue != null) {
			ownersArray.push(JSON.stringify(ownersValue));
		}

		const entryLines: string[] = [];

		const note = notes[tagName];
		if (note && note.trim()) {
			for (const raw of note.split('\n')) {
				const t = raw.trim();
				if (!t) continue;
				entryLines.push(`${entryIndent}// ${t}`);
			}
		}

		if (ownersArray.length === 0) {
			entryLines.push(`${entryIndent}${JSON.stringify(tagName)}: []`);
		} else if (ownersArray.length === 1) {
			entryLines.push(
				`${entryIndent}${JSON.stringify(tagName)}: [${JSON.stringify(
					ownersArray[0],
				)}]`,
			);
		} else {
			entryLines.push(`${entryIndent}${JSON.stringify(tagName)}: [`);
			ownersArray.forEach((owner, ownerIndex) => {
				const isLastOwner = ownerIndex === ownersArray.length - 1;
				const comma = isLastOwner ? '' : ',';
				entryLines.push(`${entryIndent}  ${JSON.stringify(owner)}${comma}`);
			});
			entryLines.push(`${entryIndent}]`);
		}

		// Add a trailing comma after this entry if it's not the last one,
		// keeping the comma on the last non-empty line of the entry.
		if (!isLast) {
			let lastIdx = entryLines.length - 1;
			while (lastIdx >= 0 && entryLines[lastIdx].trim() === '') {
				lastIdx--;
			}
			if (lastIdx >= 0) {
				const line = entryLines[lastIdx];
				const match = /(.*\S)(\s*)$/.exec(line);
				if (match) {
					entryLines[lastIdx] = `${match[1]},${match[2]}`;
				} else {
					entryLines[lastIdx] = `${line.trimEnd()},`;
				}
			}
		}

		bodyLines.push(...entryLines);
	});

	const before = lines.slice(0, tagOwnersStart);
	const after = lines.slice(tagOwnersEnd + 1);

	const resultLines = [
		...before,
		headerLine,
		...bodyLines,
		footerLine,
		...after,
	];

	return resultLines.join('\n');
}

export default function AccessControlsVisualEditor({
	policy,
	onChangePolicy,
	onSavePolicy,
}: {
	policy: string;
	onChangePolicy?: (nextPolicy: string) => void;
	onSavePolicy?: (nextPolicy: string) => void;
}) {
	const [activeTab, setActiveTab] = useState<VisualEditorTab>(
		'general-access-rules',
	);
	const [editRule, setEditRule] = useState<GeneralAccessRule | null>(null);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [editHost, setEditHost] = useState<HostEntry | null>(null);
	const [isEditHostDialogOpen, setIsEditHostDialogOpen] = useState(false);
	const [isAddHostDialogOpen, setIsAddHostDialogOpen] = useState(false);
	const [editGroup, setEditGroup] = useState<GroupEntry | null>(null);
	const [isEditGroupDialogOpen, setIsEditGroupDialogOpen] = useState(false);
	const [isAddGroupDialogOpen, setIsAddGroupDialogOpen] = useState(false);
	const [editTagOwner, setEditTagOwner] = useState<TagOwnerEntry | null>(null);
	const [isEditTagOwnerDialogOpen, setIsEditTagOwnerDialogOpen] =
		useState(false);
	const [isAddTagOwnerDialogOpen, setIsAddTagOwnerDialogOpen] = useState(false);

	const generalAccessRules = useMemo<GeneralAccessRule[]>(() => {
		if (!policy || !policy.trim()) return [];

		try {
			// The policy we get back is HuJSON (allows comments, trailing commas, etc.)
			// Normalize it to strict JSON before parsing so we can safely read `acls`.
			const normalizedPolicy = policy
				// Strip line comments starting with //
				.replace(/\/\/.*$/gm, '')
				// Remove trailing commas before } or ]
				.replace(/,(\s*[}\]])/g, '$1');

			const parsed = JSON.parse(normalizedPolicy) as {
				acls?: Array<{
					src?: string[];
					dst?: string[];
					proto?: string;
				}>;
			};

			const aclNotes = extractAclNotes(policy);

			// Headscale-style internal structure: { "acls": [{ "src": [...], "dst": [...], "proto": "tcp" }] }
			if (Array.isArray(parsed.acls)) {
				return parsed.acls.map((entry, index) => {
					const src = entry.src ?? [];
					const dst = entry.dst ?? [];
					const proto = (entry.proto ?? '').trim();

					const destinationText = dst.length ? dst.join(', ') : '—';

					const portParts: string[] = [];

					for (const spec of dst) {
						const colonIndex = spec.lastIndexOf(':');
						if (colonIndex !== -1 && colonIndex < spec.length - 1) {
							portParts.push(spec.slice(colonIndex + 1));
						}
					}

					let portSummary = '—';
					if (portParts.length) {
						portSummary = Array.from(new Set(portParts)).join(', ');
					}

					let portAndProtocol = portSummary;
					if (proto) {
						portAndProtocol =
							portSummary === '—' ? proto : `${proto} ${portSummary}`;
					}

					return {
						id: `acl-${index}`,
						source: src.length ? src.join(', ') : '—',
						destination: destinationText,
						portAndProtocol,
						note: aclNotes[index] ?? '',
						protocol: proto,
					};
				});
			}

			// No recognized ACLs structure
			return [];
		} catch {
			// Invalid JSON, don't show any rules in the visual editor.
			return [];
		}
	}, [policy]);

	const hosts = useMemo<HostEntry[]>(() => {
		if (!policy || !policy.trim()) return [];

		try {
			const normalizedPolicy = policy
				.replace(/\/\/.*$/gm, '')
				.replace(/,(\s*[}\]])/g, '$1');

			const parsed = JSON.parse(normalizedPolicy) as {
				hosts?: Record<string, string>;
			};

			const hostNotes = extractHostNotes(policy);

			if (parsed.hosts && typeof parsed.hosts === 'object') {
				const entries = Object.entries(parsed.hosts);
				return entries.map(([name, address], index) => ({
					id: `host-${index}`,
					name,
					address: String(address),
					note: hostNotes[name] ?? '',
				}));
			}

			return [];
		} catch {
			return [];
		}
	}, [policy]);

	const groups = useMemo<GroupEntry[]>(() => {
		if (!policy || !policy.trim()) return [];

		try {
			const normalizedPolicy = policy
				.replace(/\/\/.*$/gm, '')
				.replace(/,(\s*[}\]])/g, '$1');

			const parsed = JSON.parse(normalizedPolicy) as {
				groups?: Record<string, unknown>;
			};

			const groupNotes = extractGroupNotes(policy);

			if (parsed.groups && typeof parsed.groups === 'object') {
				const entries = Object.entries(
					parsed.groups as Record<string, unknown>,
				);
				return entries.map(([groupName, membersValue], index) => {
					let membersArray: string[] = [];

					if (Array.isArray(membersValue)) {
						membersArray = membersValue.map((v) => String(v));
					} else if (typeof membersValue === 'string') {
						membersArray = [membersValue];
					} else if (membersValue != null) {
						membersArray = [JSON.stringify(membersValue)];
					}

					return {
						id: `group-${index}`,
						groupName,
						members: membersArray.join(', '),
						note: groupNotes[groupName] ?? '',
					};
				});
			}

			return [];
		} catch {
			return [];
		}
	}, [policy]);

	const tagOwners = useMemo<TagOwnerEntry[]>(() => {
		if (!policy || !policy.trim()) return [];

		try {
			const normalizedPolicy = policy
				.replace(/\/\/.*$/gm, '')
				.replace(/,(\s*[}\]])/g, '$1');

			const parsed = JSON.parse(normalizedPolicy) as {
				tagOwners?: Record<string, unknown>;
			};

			const tagOwnerNotes = extractTagOwnerNotes(policy);

			if (parsed.tagOwners && typeof parsed.tagOwners === 'object') {
				const entries = Object.entries(
					parsed.tagOwners as Record<string, unknown>,
				);
				return entries.map(([tagName, ownersValue], index) => {
					let ownersArray: string[] = [];

					if (Array.isArray(ownersValue)) {
						ownersArray = ownersValue.map((v) => String(v));
					} else if (typeof ownersValue === 'string') {
						ownersArray = [ownersValue];
					} else if (ownersValue != null) {
						ownersArray = [JSON.stringify(ownersValue)];
					}

					return {
						id: `tag-owner-${index}`,
						tagName,
						owners: ownersArray.join(', '),
						note: tagOwnerNotes[tagName] ?? '',
					};
				});
			}

			return [];
		} catch {
			return [];
		}
	}, [policy]);

	const tabs: TabConfig[] = [
		{
			key: 'general-access-rules',
			label: 'General access rules',
			panel: (
				<GeneralAccessRulesPanel
					onAddRule={() => {
						setIsAddDialogOpen(true);
					}}
					onDeleteRule={(rule) => {
						// Ask for confirmation before deleting an ACL rule from the policy.
						const confirmed = window.confirm(
							'Are you sure you want to delete this access rule?',
						);
						if (!confirmed) {
							return;
						}

						const nextPolicy = deleteAclFromPolicy(policy, rule);
						if (!nextPolicy) {
							return;
						}

						if (onChangePolicy) {
							onChangePolicy(nextPolicy);
						}

						if (onSavePolicy) {
							onSavePolicy(nextPolicy);
						}
					}}
					onEditRule={(rule) => {
						setEditRule(rule);
						setIsEditDialogOpen(true);
					}}
					onReorderRules={(nextRules) => {
						const orderedRuleIds = nextRules
							.map((rule) => Number(rule.id.replace(/^acl-/, '')))
							.filter((idx) => !Number.isNaN(idx) && idx >= 0);

						const nextPolicy = reorderAclsInPolicy(policy, orderedRuleIds);
						if (!nextPolicy) {
							return;
						}

						if (onChangePolicy) {
							onChangePolicy(nextPolicy);
						}

						if (onSavePolicy) {
							onSavePolicy(nextPolicy);
						}
					}}
					rules={generalAccessRules}
				/>
			),
		},
		{
			key: 'tailscale-ssh',
			label: 'Tailscale SSH',
			panel: <TailscaleSshPanel />,
		},
		{
			key: 'groups',
			label: 'Groups',
			panel: (
				<GroupsPanel
					groups={groups}
					onAddGroup={() => {
						setIsAddGroupDialogOpen(true);
					}}
					onDeleteGroup={(group) => {
						const nextPolicy = deleteGroupFromPolicy(policy, group.groupName);
						if (!nextPolicy) {
							return;
						}

						if (onChangePolicy) {
							onChangePolicy(nextPolicy);
						}

						if (onSavePolicy) {
							onSavePolicy(nextPolicy);
						}
					}}
					onEditGroup={(group) => {
						setEditGroup(group);
						setIsEditGroupDialogOpen(true);
					}}
					onReorderGroups={(nextGroups: GroupEntry[]) => {
						const orderedGroupIds = nextGroups
							.map((group: GroupEntry) =>
								Number(group.id.replace(/^group-/, '')),
							)
							.filter((idx: number) => !Number.isNaN(idx) && idx >= 0);

						const nextPolicy = reorderGroupsInPolicy(policy, orderedGroupIds);
						if (!nextPolicy) {
							return;
						}

						if (onChangePolicy) {
							onChangePolicy(nextPolicy);
						}

						if (onSavePolicy) {
							onSavePolicy(nextPolicy);
						}
					}}
				/>
			),
		},
		{
			key: 'tags',
			label: 'Tags',
			panel: (
				<TagsPanel
					onAddTagOwner={() => {
						setIsAddTagOwnerDialogOpen(true);
					}}
					onDeleteTagOwner={(entry) => {
						const nextPolicy = deleteTagOwnerFromPolicy(policy, entry.tagName);
						if (!nextPolicy) {
							return;
						}

						if (onChangePolicy) {
							onChangePolicy(nextPolicy);
						}

						if (onSavePolicy) {
							onSavePolicy(nextPolicy);
						}
					}}
					onEditTagOwner={(entry) => {
						setEditTagOwner(entry);
						setIsEditTagOwnerDialogOpen(true);
					}}
					onReorderTagOwners={(nextEntries: TagOwnerEntry[]) => {
						const orderedTagIds = nextEntries
							.map((entry: TagOwnerEntry) =>
								Number(entry.id.replace(/^tag-owner-/, '')),
							)
							.filter((idx: number) => !Number.isNaN(idx) && idx >= 0);

						const nextPolicy = reorderTagOwnersInPolicy(policy, orderedTagIds);
						if (!nextPolicy) {
							return;
						}

						if (onChangePolicy) {
							onChangePolicy(nextPolicy);
						}

						if (onSavePolicy) {
							onSavePolicy(nextPolicy);
						}
					}}
					tagOwners={tagOwners}
				/>
			),
		},
		{
			key: 'hosts',
			label: 'Hosts',
			panel: (
				<HostsPanel
					hosts={hosts}
					onAddHost={() => {
						setIsAddHostDialogOpen(true);
					}}
					onDeleteHost={(host) => {
						const nextPolicy = deleteHostFromPolicy(policy, host.name);
						if (!nextPolicy) {
							return;
						}

						if (onChangePolicy) {
							onChangePolicy(nextPolicy);
						}

						if (onSavePolicy) {
							onSavePolicy(nextPolicy);
						}
					}}
					onEditHost={(host) => {
						setEditHost(host);
						setIsEditHostDialogOpen(true);
					}}
					onReorderHosts={(nextHosts: HostEntry[]) => {
						const orderedHostIds = nextHosts
							.map((host: HostEntry) => Number(host.id.replace(/^host-/, '')))
							.filter((idx: number) => !Number.isNaN(idx) && idx >= 0);

						const nextPolicy = reorderHostsInPolicy(policy, orderedHostIds);
						if (!nextPolicy) {
							return;
						}

						if (onChangePolicy) {
							onChangePolicy(nextPolicy);
						}

						if (onSavePolicy) {
							onSavePolicy(nextPolicy);
						}
					}}
				/>
			),
		},
	];

	return (
		<div className="mt-6">
			{/* Top navigation row (tabs) */}
			<div
				aria-label="Access controls visual editor sections"
				className={cn(
					'flex overflow-x-auto overflow-y-hidden',
					'border-b border-headplane-100 dark:border-headplane-800',
					'pb-0.5',
				)}
				role="tablist"
			>
				{tabs.map((tab) => {
					const isActive = tab.key === activeTab;

					return (
						<button
							aria-controls={`acls-visual-${tab.key}-panel`}
							aria-selected={isActive}
							className={cn(
								'relative -mb-px px-3 py-2 first:-ml-2',
								'text-sm font-medium whitespace-nowrap select-none',
								'border-b-2 border-transparent',
								'transition-colors duration-150 ease-in-out',
								isActive
									? 'text-headplane-900 dark:text-headplane-50 border-headplane-900 dark:border-headplane-50'
									: 'text-headplane-500 dark:text-headplane-400 hover:text-headplane-800 dark:hover:text-headplane-50',
							)}
							id={`acls-visual-${tab.key}-tab`}
							key={tab.key}
							onClick={() => setActiveTab(tab.key)}
							role="tab"
							type="button"
						>
							{tab.label}
						</button>
					);
				})}
			</div>

			{/* Active panel */}
			{tabs.map((tab) => (
				<div
					aria-labelledby={`acls-visual-${tab.key}-tab`}
					className={cn('mt-6 focus:outline-none', {
						hidden: tab.key !== activeTab,
					})}
					id={`acls-visual-${tab.key}-panel`}
					key={tab.key}
					role="tabpanel"
				>
					{tab.panel}
				</div>
			))}
			<EditGeneralAccessRuleDialog
				isOpen={isEditDialogOpen}
				onSave={(input) => {
					if (!editRule) {
						return;
					}

					const index = Number(editRule.id.replace(/^acl-/, ''));
					const nextPolicy = updateAclInPolicy(policy, index, input);
					if (!nextPolicy) {
						return;
					}

					if (onChangePolicy) {
						onChangePolicy(nextPolicy);
					}

					if (onSavePolicy) {
						onSavePolicy(nextPolicy);
					}
				}}
				rule={editRule}
				setIsOpen={setIsEditDialogOpen}
			/>
			<AddGeneralAccessRuleDialog
				isOpen={isAddDialogOpen}
				onAddRule={(input) => {
					const nextPolicy = addAclToPolicy(policy, input);
					if (!nextPolicy) {
						return;
					}

					if (onChangePolicy) {
						onChangePolicy(nextPolicy);
					}

					if (onSavePolicy) {
						onSavePolicy(nextPolicy);
					}
				}}
				setIsOpen={setIsAddDialogOpen}
			/>
			<EditHostDialog
				host={editHost}
				isOpen={isEditHostDialogOpen}
				onSave={(input: { name: string; address: string; note: string }) => {
					if (!editHost) {
						return;
					}

					const nextPolicy = updateHostInPolicy(policy, editHost.name, input);
					if (!nextPolicy) {
						return;
					}

					if (onChangePolicy) {
						onChangePolicy(nextPolicy);
					}

					if (onSavePolicy) {
						onSavePolicy(nextPolicy);
					}
				}}
				setIsOpen={setIsEditHostDialogOpen}
			/>
			<AddHostDialog
				isOpen={isAddHostDialogOpen}
				onAddHost={(input: NewHostInput) => {
					const nextPolicy = addHostToPolicy(policy, input);
					if (!nextPolicy) {
						return;
					}

					if (onChangePolicy) {
						onChangePolicy(nextPolicy);
					}

					if (onSavePolicy) {
						onSavePolicy(nextPolicy);
					}
				}}
				setIsOpen={setIsAddHostDialogOpen}
			/>
			<EditGroupDialog
				entry={editGroup}
				isOpen={isEditGroupDialogOpen}
				onSave={(input: {
					groupName: string;
					members: string;
					note: string;
				}) => {
					if (!editGroup) {
						return;
					}

					const nextPolicy = updateGroupInPolicy(
						policy,
						editGroup.groupName,
						input,
					);
					if (!nextPolicy) {
						return;
					}

					if (onChangePolicy) {
						onChangePolicy(nextPolicy);
					}

					if (onSavePolicy) {
						onSavePolicy(nextPolicy);
					}
				}}
				setIsOpen={setIsEditGroupDialogOpen}
			/>
			<AddGroupDialog
				isOpen={isAddGroupDialogOpen}
				onAddGroup={(input: NewGroupInput) => {
					const nextPolicy = addGroupToPolicy(policy, input);
					if (!nextPolicy) {
						return;
					}

					if (onChangePolicy) {
						onChangePolicy(nextPolicy);
					}

					if (onSavePolicy) {
						onSavePolicy(nextPolicy);
					}
				}}
				setIsOpen={setIsAddGroupDialogOpen}
			/>
			<EditTagOwnerDialog
				entry={editTagOwner}
				isOpen={isEditTagOwnerDialogOpen}
				onSave={(input: { tagName: string; owners: string; note: string }) => {
					if (!editTagOwner) {
						return;
					}

					const nextPolicy = updateTagOwnerInPolicy(
						policy,
						editTagOwner.tagName,
						input,
					);
					if (!nextPolicy) {
						return;
					}

					if (onChangePolicy) {
						onChangePolicy(nextPolicy);
					}

					if (onSavePolicy) {
						onSavePolicy(nextPolicy);
					}
				}}
				setIsOpen={setIsEditTagOwnerDialogOpen}
			/>
			<AddTagOwnerDialog
				isOpen={isAddTagOwnerDialogOpen}
				onAddTagOwner={(input: NewTagOwnerInput) => {
					const nextPolicy = addTagOwnerToPolicy(policy, input);
					if (!nextPolicy) {
						return;
					}

					if (onChangePolicy) {
						onChangePolicy(nextPolicy);
					}

					if (onSavePolicy) {
						onSavePolicy(nextPolicy);
					}
				}}
				setIsOpen={setIsAddTagOwnerDialogOpen}
			/>
		</div>
	);
}
