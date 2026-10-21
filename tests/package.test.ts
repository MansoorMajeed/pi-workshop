import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { InMemoryCredentialStore, type Model } from "@earendil-works/pi-ai";
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const offlineModel: Model<"openai-completions"> = {
	id: "offline-fixture",
	name: "Offline fixture",
	api: "openai-completions",
	provider: "offline-fixture",
	baseUrl: "http://127.0.0.1:1",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 4096,
	maxTokens: 1024,
};

describe("pi package", () => {
	let tempRoot: string;
	let loader: DefaultResourceLoader;

	beforeAll(async () => {
		tempRoot = await mkdtemp(join(tmpdir(), "workshop-package-"));
		await mkdir(join(tempRoot, "project"));
		loader = new DefaultResourceLoader({
			cwd: join(tempRoot, "project"),
			agentDir: join(tempRoot, "agent"),
			settingsManager: SettingsManager.inMemory({}, { projectTrusted: true }),
			additionalExtensionPaths: [packageRoot],
			noExtensions: true,
			noSkills: true,
			noPromptTemplates: true,
			noThemes: true,
			noContextFiles: true,
		});
		await loader.reload();
	}, 30_000);

	afterAll(async () => {
		await rm(tempRoot, { recursive: true, force: true });
	});

	it("loads the manifest extension and registers the workshop tools without errors", async () => {
		const extensions = loader.getExtensions().extensions.map((e) => relative(packageRoot, e.resolvedPath).replaceAll("\\", "/"));
		expect(extensions).toEqual(["src/index.ts"]);
		expect(loader.getExtensions().errors).toEqual([]);

		const runtimeErrors: unknown[] = [];
		const modelRuntime = await ModelRuntime.create({
			credentials: new InMemoryCredentialStore(),
			modelsPath: null,
			allowModelNetwork: false,
			refreshOnCreate: false,
		});
		const { session } = await createAgentSession({
			cwd: join(tempRoot, "project"),
			agentDir: join(tempRoot, "agent"),
			model: offlineModel,
			modelRuntime,
			resourceLoader: loader,
			sessionManager: SessionManager.inMemory(join(tempRoot, "project")),
			settingsManager: SettingsManager.inMemory({}, { projectTrusted: true }),
		});
		try {
			await session.bindExtensions({ mode: "print", onError: (error) => runtimeErrors.push(error) });
			const names = session.getAllTools().map((t) => t.name);
			expect(names).toEqual(expect.arrayContaining(["workshop_open", "workshop_comment", "workshop_reply"]));
			expect(runtimeErrors).toEqual([]);
		} finally {
			session.dispose();
		}
	}, 30_000);
});
