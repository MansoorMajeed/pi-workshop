import type { Token } from "marked";
import { lex, renderDocument, type Block } from "./render";

export class BlockEditError extends Error {
	constructor(readonly reason: "changed" | "breaks", message: string) {
		super(message);
	}
}

const CHANGED = "This block changed since you started editing.";
const BREAKS = "This edit would also change the text around it (for example, an unclosed code fence). Fix it, or use Edit for the whole file.";
const BOM = "\uFEFF";

/** Offset in `file` of the character at `offset` in its LF-normalized form (CRLF counts as one character). */
function originalOffset(file: string, offset: number): number {
	let i = 0;
	for (let k = 0; k < offset; k++) i += file[i] === "\r" && file[i + 1] === "\n" ? 2 : 1;
	return i;
}

/**
 * The part of a block the user edits, which also identifies it: its Markdown without the newlines that
 * separate it from the next block, or a byte-order mark at the start of the file.
 */
export function editableSource(block: Block): string {
	return block.raw.replace(/^\uFEFF/, "").replace(/\n+$/, "");
}

/** Which block the viewer opened: its text, which identical copy it was, and how many copies there were. */
export interface BlockTarget {
	original: string;
	occurrence: number;
	copies: number;
}

const sameToken = (a: Token, b: Token | undefined) => b !== undefined && a.type === b.type && a.raw === b.raw;

/**
 * Replace one top-level block's Markdown and return the new file. Every byte outside the block is copied
 * from `file` unchanged. The block is found by its text, so renaming its section or moving it doesn't matter.
 * Throws BlockEditError when the block's text is gone (or can't be told apart from an identical block after
 * the file changed), or when the new text would change how any other block parses.
 */
export function replaceBlock(file: string, target: BlockTarget, text: string, { fileChanged }: { fileChanged: boolean }): string {
	const tokens = lex(file);
	if (tokens.map((t) => t.raw).join("") !== file.replace(/\r\n|\r/g, "\n")) {
		throw new BlockEditError("breaks", "This document can't be edited one block at a time. Use Edit for the whole file.");
	}
	const copies = renderDocument(file).blocks.filter((b) => editableSource(b) === target.original);
	// The copy number is a position, so it only holds while the file is unchanged. After a change, an
	// identical block may have been added, or the one being edited deleted, so only a block that was
	// and still is the only one with this text can be trusted.
	const block = !fileChanged ? copies[target.occurrence] : target.copies === 1 && copies.length === 1 ? copies[0] : undefined;
	if (!block) throw new BlockEditError("changed", CHANGED);

	// The block's trailing newlines separate it from the next block; keep them as they are.
	let start = block.start;
	let body = block.raw.replace(/\n+$/, "");
	if (start === 0 && body.startsWith(BOM)) {
		start = 1;
		body = body.slice(1);
	}
	const from = originalOffset(file, start);
	const to = originalOffset(file, start + body.length);
	const end = originalOffset(file, block.start + block.raw.length);
	const eol = (file.slice(from, end).match(/\r\n|\r|\n/) ?? file.match(/\r\n|\r|\n/))?.[0] ?? "\n";
	const replacement = text.replace(/^\uFEFF/, "").replace(/\r\n|\r/g, "\n").replace(/\n+$/, "").replace(/\n/g, eol);
	const next = file.slice(0, from) + replacement + file.slice(to);

	// Everything before and after the edited block must still parse exactly as it did.
	let offset = 0;
	const edited = tokens.findIndex((t) => (offset += t.raw.length) - t.raw.length === block.start);
	const head = tokens.slice(0, edited).filter((t) => t.type !== "space");
	const tail = tokens.slice(edited + 1).filter((t) => t.type !== "space");
	const after = lex(next).filter((t) => t.type !== "space");
	const unchanged =
		after.length >= head.length + tail.length &&
		head.every((t, i) => sameToken(t, after[i])) &&
		tail.every((t, i) => sameToken(t, after[after.length - tail.length + i]));
	if (!unchanged) throw new BlockEditError("breaks", BREAKS);
	return next;
}
