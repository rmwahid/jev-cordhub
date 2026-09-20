/**
 * The categories every repository is judged against.
 *
 * KEEP THIS FILE FREE OF NODE IMPORTS. A component imports it to explain a
 * label, which puts it in the browser bundle, and a Node builtin here breaks
 * hydration: the page arrives from the server looking perfect, then the client
 * fails to load the module and replaces itself with an error page. The version
 * fingerprint needs `node:crypto`, so it lives in
 * `$lib/server/taxonomy-version.ts` instead. `tests/client-safety.test.ts`
 * enforces this.
 *
 * This file is the source of truth, and it lives in the repository rather than
 * beside the pipeline scripts, because the categories are part of what this
 * product is: they are the vocabulary it offers and the labels it shows. A
 * clone of this repository that could not see them would ship a catalogue full
 * of category names that mean nothing to a reader, which is exactly what the
 * version hash below would be pointing at.
 *
 * Ids stay English because code and stored records use them. The Indonesian
 * phrases inside the descriptions are data, not prose: they are the vocabulary
 * people actually type in the channel, and since almost every link message
 * carries no text at all, this is the only place that vocabulary can enter the
 * index. Editing a description therefore changes search behaviour, not just
 * documentation.
 */
export const USAGE_CRITERIA = {
	'coding-agent':
		'coding agent, AI pair programmer, autonomous code editor, agent harness, agent runner, terminal agent. "agent buat ngoding", "AI yang nulis kode"',
	'agent-skills':
		'skills, plugins, slash commands, prompt packs, rules, personas, instruction sets added to an existing agent. "skill buat claude code", "prompt pack", "plugin agent"',
	'mcp-server':
		'MCP server, tools exposed to an agent over the Model Context Protocol, MCP registry, MCP gateway. "mcp", "server mcp", "tool buat agent"',
	'agent-orchestration':
		'running several agents together, agent workflows, visual agent builders, task delegation between agents. "orkestrasi agent", "multi agent", "alur agent"',
	'agent-context-memory':
		'context engineering, agent memory, session persistence, retrieval and RAG for agents, knowledge injection. "memory agent", "context", "rag"',
	'model-serving':
		'running or serving AI models yourself, inference engine, model runtime, quantization, local LLM. "jalanin model lokal", "ollama", "inference"',
	'ai-app': 'a finished AI product used directly rather than built with. "aplikasi AI", "tool AI siap pakai"',
	'self-hosted-app':
		'an application or service you host yourself, self-hosted alternative to a paid product, dashboard, personal cloud. "self hosted", "hosting sendiri", "alternatif X"',
	'infra-homelab':
		'servers, containers, deployment, networking, reverse proxy, certificates, home server operating systems. "docker", "homelab", "server"',
	'hardware-embedded':
		'firmware, microcontroller, embedded systems, robotics, drones, single board computers, sensors, electronics, satellite and radio hardware. "arduino", "esp32", "robot", "firmware", "mikrokontroler". Not for software that merely runs on your own server or controls smart home devices, which is infra-homelab or self-hosted-app',
	'security-privacy':
		'security tooling, vulnerability scanning, secrets management, hardening, privacy, ad blocking, threat intelligence. "security", "privasi", "hardening"',
	'terminal-tool':
		'command line utilities, terminal interfaces, shell tools, terminal clients, dotfiles and themes. "cli", "terminal", "tui"',
	'dev-tooling':
		'the rest of the software building toolchain: build tools, bundlers, linters, formatters, testing, editors, git, CI. "build tool", "bundler", "linter"',
	'data-tooling': 'databases, query engines, data pipelines, versioned data, storage. "database", "data"',
	'finance-trading':
		'trading bots and strategies, quantitative finance, market and stock data, investment research, portfolio and accounting tools. "trading", "saham", "quant", "bot crypto"',
	'frontend-web': 'UI libraries, components, CSS, styling, web frameworks. "ui", "komponen", "css"',
	'productivity-app':
		'notes, task management, calendars, knowledge bases, personal organization. "notes", "task", "produktivitas"',
	'media-tool': 'audio, video, images: downloading, converting, generating. "video", "audio", "gambar"',
	'learning-resource':
		'collections of links, awesome lists, guides, tutorials, roadmaps, reading material. Nothing to run. "awesome list", "kumpulan link", "belajar"',
	// `other` used to be null, which left the model no guidance about what
	// belongs here, so repositories outside the taxonomy were forced into the
	// nearest wrong category instead of landing here honestly. Naming the known
	// gaps gives it a legitimate place to put them.
	other:
		'nothing above fits: protocols and standards, payments and billing infrastructure, niche domains such as healthcare or education, or the repository has too little information to tell'
};

export const FORM_CRITERIA = {
	library: 'imported into your own code as a dependency',
	cli: 'installed and run as a command',
	app: 'deployed, hosted, or opened as finished software',
	framework: 'used as a base to build something of your own on top',
	'agent-addon': 'dropped into an existing agent: skill, plugin, prompt, rule',
	server: 'run as a service that another program connects to, including MCP servers and API servers',
	config: 'dotfiles, themes, setup scripts',
	list: 'a collection of links or reading material, nothing to run',
	dataset: 'data to consume rather than code'
};

export const USABILITY_CRITERIA = [
	'1 - only reading material or reference, cannot be used to build anything',
	'2 - useful as a reference but must be rewritten first',
	'3 - usable as material, still needs significant work',
	'4 - usable to build something with minor adjustment',
	'5 - ready to use now, install and go'
];

/** What a usage id means, for explaining a label to whoever is reading it. */
export function usageMeaning(id: string | null | undefined): string | null {
	if (!id) return null;
	return (USAGE_CRITERIA as Record<string, string | null>)[id] ?? null;
}

/** What a form id means. */
export function formMeaning(id: string | null | undefined): string | null {
	if (!id) return null;
	return (FORM_CRITERIA as Record<string, string>)[id] ?? null;
}
