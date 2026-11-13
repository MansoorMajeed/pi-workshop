import { describe, expect, it } from "vitest";
import { BlockEditError, editableSource, replaceBlock } from "../src/edit";
import { renderDocument } from "../src/render";

/** Documents with awkward bytes: CRLF, mixed endings, BOM, tabs, trailing spaces, adjacent blocks, no final newline. */
const FIXTURES = {
	lf: "# Plan\n\nIntro *text*.\n\n## Tasks\n\n- [ ] one\n- [ ] two\n  - nested\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n> [!DECISION]\n> Pick A.\n\n```mermaid\ngraph TD; A-->B\n```\n\n[ref]: https://example.com\n\nLast line",
	crlf: "# Plan\r\n\r\nIntro.\r\nSecond line.\r\n\r\n- one\r\n- two\r\n",
	mixed: "# Plan\r\n\r\nCRLF para.\r\n\nLF para.\nmore\n\r\n- item\r\n",
	bom: "\uFEFF# Plan\n\nBody.\n",
	adjacent: "# A\nfoo\n===\n## B\npara\n",
	whitespace: "\tcode block\n\npara with trailing spaces   \nnext\n\n\n\n<div>html</div>\n",
	loneCr: "# Plan\r\rOld mac.\r",
};

const ids = (file: string) => renderDocument(file).blocks;
const editable = (raw: string) => raw.replace(/\n+$/, "");
/** What the viewer sends to identify a block: its editable text, which identical copy it is, and how many copies there were. */
const at = (file: string, block: ReturnType<typeof ids>[number]) => {
	const copies = ids(file).filter((b) => editableSource(b) === editableSource(block));
	return { original: editableSource(block), occurrence: copies.findIndex((b) => b.id === block.id), copies: copies.length };
};

describe("replaceBlock", () => {
	it("returns the file byte-for-byte when a block is saved unchanged", () => {
		for (const [name, file] of Object.entries(FIXTURES)) {
			for (const block of ids(file)) {
				expect(replaceBlock(file, at(file, block), editableSource(block), { fileChanged: false }), `${name}: ${block.id}`).toBe(file);
			}
		}
	});

	it("changes only the edited block's bytes", () => {
		const file = FIXTURES.lf;
		const target = ids(file).find((b) => b.text === "Intro *text*.")!;
		expect(replaceBlock(file, at(file, target), "New **intro**.", { fileChanged: false })).toBe(file.replace("Intro *text*.", "New **intro**."));
	});

	it("writes new lines with the block's own line ending and leaves the rest alone", () => {
		const crlf = FIXTURES.crlf;
		const para = ids(crlf).find((b) => b.kind === "paragraph")!;
		expect(replaceBlock(crlf, at(crlf, para), "A\nB\nC", { fileChanged: false })).toBe("# Plan\r\n\r\nA\r\nB\r\nC\r\n\r\n- one\r\n- two\r\n");

		const mixed = FIXTURES.mixed;
		const lf = ids(mixed).find((b) => b.text.startsWith("LF para"))!;
		expect(replaceBlock(mixed, at(mixed, lf), "x\ny", { fileChanged: false })).toBe("# Plan\r\n\r\nCRLF para.\r\n\nx\ny\n\r\n- item\r\n");
		const cr = ids(mixed).find((b) => b.text.startsWith("CRLF para"))!;
		expect(replaceBlock(mixed, at(mixed, cr), "x\ny", { fileChanged: false })).toBe("# Plan\r\n\r\nx\r\ny\r\n\nLF para.\nmore\n\r\n- item\r\n");

		const single = ids(crlf)[0];
		expect(replaceBlock(crlf, at(crlf, single), "# Title\nIntro", { fileChanged: false })).toBe(crlf.replace("# Plan", "# Title\r\nIntro"));
		const loneCr = ids(FIXTURES.loneCr).find((b) => b.kind === "paragraph")!;
		expect(replaceBlock(FIXTURES.loneCr, at(FIXTURES.loneCr, loneCr), "a\nb", { fileChanged: false })).toBe("# Plan\r\ra\rb\r");
	});

	it("normalizes submitted line endings and drops trailing blank lines", () => {
		const file = FIXTURES.crlf;
		const para = ids(file).find((b) => b.kind === "paragraph")!;
		expect(replaceBlock(file, at(file, para), "A\r\nB\n\n\n", { fileChanged: false })).toBe("# Plan\r\n\r\nA\r\nB\r\n\r\n- one\r\n- two\r\n");
	});

	it("keeps the newline that separates the block from the next one", () => {
		const file = FIXTURES.adjacent;
		const heading = ids(file)[0];
		expect(heading.raw).toBe("# A\n");
		expect(replaceBlock(file, at(file, heading), "# Renamed", { fileChanged: false })).toBe("# Renamed\nfoo\n===\n## B\npara\n");
	});

	it("keeps a byte-order mark at the start of the file", () => {
		const file = FIXTURES.bom;
		const first = ids(file)[0];
		expect(replaceBlock(file, at(file, first), editable(first.raw).replace("Plan", "Draft"), { fileChanged: false })).toBe("\uFEFF# Draft\n\nBody.\n");
		expect(replaceBlock(file, at(file, first), "# Draft", { fileChanged: false })).toBe("\uFEFF# Draft\n\nBody.\n");
		const body = ids(file).at(-1)!;
		expect(replaceBlock(file, at(file, body), "New.", { fileChanged: false })).toBe("\uFEFF# Plan\n\nNew.\n");
	});

	it("deletes a block saved empty and splits one saved with a blank line", () => {
		const file = "# Plan\n\nOne.\n\nTwo.\n";
		const one = ids(file)[1];
		expect(replaceBlock(file, at(file, one), "", { fileChanged: false })).toBe("# Plan\n\n\n\nTwo.\n");
		expect(replaceBlock(file, at(file, one), "A.\n\nB.", { fileChanged: false })).toBe("# Plan\n\nA.\n\nB.\n\nTwo.\n");
	});

	it("edits Mermaid source inside its fence", () => {
		const file = FIXTURES.lf;
		const diagram = ids(file).find((b) => b.kind === "mermaid")!;
		expect(editable(diagram.raw)).toBe("```mermaid\ngraph TD; A-->B\n```");
		expect(replaceBlock(file, at(file, diagram), "```mermaid\ngraph LR; A-->C\n```", { fileChanged: false })).toBe(file.replace("graph TD; A-->B", "graph LR; A-->C"));
	});

	it("finds the block by its text after its heading is renamed or it moves", () => {
		const file = "# Plan\n\n## Proposal\n\nMy paragraph.\n\nOther.\n";
		const target = at(file, ids(file).find((b) => b.text === "My paragraph.")!);
		const renamed = "# Plan\n\n## Renamed section\n\nNew text above.\n\nMy paragraph.\n\nOther.\n";
		expect(replaceBlock(renamed, target, "Edited.", { fileChanged: true })).toBe(renamed.replace("My paragraph.", "Edited."));
		const moved = "# Plan\n\nOther.\n\n## Later\n\nMy paragraph.\n";
		expect(replaceBlock(moved, target, "Edited.", { fileChanged: true })).toBe("# Plan\n\nOther.\n\n## Later\n\nEdited.\n");
	});

	it("refuses when the block's text is no longer in the file, even if only its spacing changed", () => {
		const file = "# Plan\n\nMy  paragraph.\n";
		const target = at(file, ids(file)[1]);
		for (const changed of ["# Plan\n\nMy paragraph.\n", "# Plan\n\nSomeone else's words.\n"]) {
			expect(() => replaceBlock(changed, target, "Mine.", { fileChanged: true })).toThrow(expect.objectContaining({ reason: "changed" }));
		}
		expect(() => replaceBlock(file, { original: "Not in the file.", occurrence: 0, copies: 1 }, "x", { fileChanged: false })).toThrow(BlockEditError);
		expect(() => replaceBlock(file, { original: editableSource(ids(file)[1]), occurrence: 1, copies: 1 }, "x", { fileChanged: false })).toThrow(expect.objectContaining({ reason: "changed" }));
	});

	it("refuses edits that would change how other blocks read", () => {
		const file = FIXTURES.lf;
		const intro = ids(file).find((b) => b.text === "Intro *text*.")!;
		// An unclosed fence would swallow the rest of the document.
		expect(() => replaceBlock(file, at(file, intro), "```\nunclosed", { fileChanged: false })).toThrow(expect.objectContaining({ reason: "breaks" }));
		// A setext underline would turn the paragraph above into a heading.
		const adjacent = "intro\n# Head\n\nrest\n";
		const head = ids(adjacent).find((b) => b.kind === "heading")!;
		expect(() => replaceBlock(adjacent, at(adjacent, head), "===", { fileChanged: false })).toThrow(expect.objectContaining({ reason: "breaks" }));
		// Turning a paragraph into a list item pulls the indented paragraph after it into the list.
		const indented = "Para.\n\n  indented follow\n";
		const para = ids(indented)[0];
		expect(() => replaceBlock(indented, at(indented, para), "- Para.", { fileChanged: false })).toThrow(expect.objectContaining({ reason: "breaks" }));
	});

	it("uses the copy number for identical blocks only while the file is unchanged", () => {
		const file = "# Notes\n\nSame.\n\n---\n\nSame.\n";
		const second = at(file, ids(file)[3]);
		expect(second).toEqual({ original: "Same.", occurrence: 1, copies: 2 });
		expect(replaceBlock(file, second, "Edited.", { fileChanged: false })).toBe("# Notes\n\nSame.\n\n---\n\nEdited.\n");
		const changed = "# Renamed\n\nSame.\n\n---\n\nSame.\n";
		expect(() => replaceBlock(changed, second, "Edited.", { fileChanged: true })).toThrow(expect.objectContaining({ reason: "changed" }));
		// One copy left is still ambiguous: the deleted one may have been the copy being edited.
		const one = "# Notes\n\n---\n\nSame.\n";
		expect(() => replaceBlock(one, second, "Edited.", { fileChanged: true })).toThrow(expect.objectContaining({ reason: "changed" }));
	});
});
