import { describe, expect, it } from "vitest";
import { BlockEditError, replaceBlock } from "../src/edit";
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

describe("replaceBlock", () => {
	it("returns the file byte-for-byte when a block is saved unchanged", () => {
		for (const [name, file] of Object.entries(FIXTURES)) {
			for (const block of ids(file)) {
				expect(replaceBlock(file, block.id, editable(block.raw), { fileChanged: false }), `${name}: ${block.id}`).toBe(file);
			}
		}
	});

	it("changes only the edited block's bytes", () => {
		const file = FIXTURES.lf;
		const target = ids(file).find((b) => b.text === "Intro *text*.")!;
		expect(replaceBlock(file, target.id, "New **intro**.", { fileChanged: false })).toBe(file.replace("Intro *text*.", "New **intro**."));
	});

	it("writes new lines with the block's own line ending and leaves the rest alone", () => {
		const crlf = FIXTURES.crlf;
		const para = ids(crlf).find((b) => b.kind === "paragraph")!;
		expect(replaceBlock(crlf, para.id, "A\nB\nC", { fileChanged: false })).toBe("# Plan\r\n\r\nA\r\nB\r\nC\r\n\r\n- one\r\n- two\r\n");

		const mixed = FIXTURES.mixed;
		const lf = ids(mixed).find((b) => b.text.startsWith("LF para"))!;
		expect(replaceBlock(mixed, lf.id, "x\ny", { fileChanged: false })).toBe("# Plan\r\n\r\nCRLF para.\r\n\nx\ny\n\r\n- item\r\n");
		const cr = ids(mixed).find((b) => b.text.startsWith("CRLF para"))!;
		expect(replaceBlock(mixed, cr.id, "x\ny", { fileChanged: false })).toBe("# Plan\r\n\r\nx\r\ny\r\n\nLF para.\nmore\n\r\n- item\r\n");

		const single = ids(crlf)[0];
		expect(replaceBlock(crlf, single.id, "# Title\nIntro", { fileChanged: false })).toBe(crlf.replace("# Plan", "# Title\r\nIntro"));
		const loneCr = ids(FIXTURES.loneCr).find((b) => b.kind === "paragraph")!;
		expect(replaceBlock(FIXTURES.loneCr, loneCr.id, "a\nb", { fileChanged: false })).toBe("# Plan\r\ra\rb\r");
	});

	it("normalizes submitted line endings and drops trailing blank lines", () => {
		const file = FIXTURES.crlf;
		const para = ids(file).find((b) => b.kind === "paragraph")!;
		expect(replaceBlock(file, para.id, "A\r\nB\n\n\n", { fileChanged: false })).toBe("# Plan\r\n\r\nA\r\nB\r\n\r\n- one\r\n- two\r\n");
	});

	it("keeps the newline that separates the block from the next one", () => {
		const file = FIXTURES.adjacent;
		const heading = ids(file)[0];
		expect(heading.raw).toBe("# A\n");
		expect(replaceBlock(file, heading.id, "# Renamed", { fileChanged: false })).toBe("# Renamed\nfoo\n===\n## B\npara\n");
	});

	it("keeps a byte-order mark at the start of the file", () => {
		const file = FIXTURES.bom;
		const first = ids(file)[0];
		expect(replaceBlock(file, first.id, editable(first.raw).replace("Plan", "Draft"), { fileChanged: false })).toBe("\uFEFF# Draft\n\nBody.\n");
		expect(replaceBlock(file, first.id, "# Draft", { fileChanged: false })).toBe("\uFEFF# Draft\n\nBody.\n");
		const body = ids(file).at(-1)!;
		expect(replaceBlock(file, body.id, "New.", { fileChanged: false })).toBe("\uFEFF# Plan\n\nNew.\n");
	});

	it("deletes a block saved empty and splits one saved with a blank line", () => {
		const file = "# Plan\n\nOne.\n\nTwo.\n";
		const one = ids(file)[1];
		expect(replaceBlock(file, one.id, "", { fileChanged: false })).toBe("# Plan\n\n\n\nTwo.\n");
		expect(replaceBlock(file, one.id, "A.\n\nB.", { fileChanged: false })).toBe("# Plan\n\nA.\n\nB.\n\nTwo.\n");
	});

	it("edits Mermaid source inside its fence", () => {
		const file = FIXTURES.lf;
		const diagram = ids(file).find((b) => b.kind === "mermaid")!;
		expect(editable(diagram.raw)).toBe("```mermaid\ngraph TD; A-->B\n```");
		expect(replaceBlock(file, diagram.id, "```mermaid\ngraph LR; A-->C\n```", { fileChanged: false })).toBe(file.replace("graph TD; A-->B", "graph LR; A-->C"));
	});

	it("refuses when the block is no longer in the file", () => {
		const file = FIXTURES.lf;
		expect(() => replaceBlock(file, "tasks--deadbeef", "x", { fileChanged: true })).toThrow(BlockEditError);
		try {
			replaceBlock(file, "tasks--deadbeef", "x", { fileChanged: true });
		} catch (error) {
			expect((error as BlockEditError).reason).toBe("changed");
		}
	});

	it("refuses edits that would change how other blocks read", () => {
		const file = FIXTURES.lf;
		const intro = ids(file).find((b) => b.text === "Intro *text*.")!;
		// An unclosed fence would swallow the rest of the document.
		expect(() => replaceBlock(file, intro.id, "```\nunclosed", { fileChanged: false })).toThrow(expect.objectContaining({ reason: "breaks" }));
		// A setext underline would turn the paragraph above into a heading.
		const adjacent = "intro\n# Head\n\nrest\n";
		const head = ids(adjacent).find((b) => b.kind === "heading")!;
		expect(() => replaceBlock(adjacent, head.id, "===", { fileChanged: false })).toThrow(expect.objectContaining({ reason: "breaks" }));
		// Turning a paragraph into a list item pulls the indented paragraph after it into the list.
		const indented = "Para.\n\n  indented follow\n";
		const para = ids(indented)[0];
		expect(() => replaceBlock(indented, para.id, "- Para.", { fileChanged: false })).toThrow(expect.objectContaining({ reason: "breaks" }));
	});

	it("refuses to pick between identical blocks once the file has changed", () => {
		const file = "# Notes\n\nSame.\n\nSame.\n";
		const second = ids(file)[2];
		expect(replaceBlock(file, second.id, "Edited.", { fileChanged: false })).toBe("# Notes\n\nSame.\n\nEdited.\n");
		const moved = "# Notes\n\nSame.\n\nSame.\n\nSame.\n";
		expect(() => replaceBlock(moved, second.id, "Edited.", { fileChanged: true })).toThrow(expect.objectContaining({ reason: "changed" }));
		const unique = ids(FIXTURES.lf).find((b) => b.text === "Intro *text*.")!;
		expect(replaceBlock(`${FIXTURES.lf}\n\nAppended.`, unique.id, "X.", { fileChanged: true })).toContain("\n\nX.\n\n## Tasks");
	});
});
