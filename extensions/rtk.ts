/**
 * RTK (Rust Token Killer) Integration for Pi
 *
 * Automatically rewrites bash commands to their RTK equivalents,
 * reducing CLI output noise before it enters the LLM context window.
 *
 * Shows transparency: every rewrite is labeled so you know RTK is active.
 *
 * RTK must be installed: https://github.com/rtk-ai/rtk
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawnSync } from "node:child_process";

const RTK_CACHE = new Map<string, string | null>();
const RTK_TIMEOUT_MS = 1500;
const REWRITE_TRACKER = new Map<string, { original: string; rewritten: string }>();

function checkRtkAvailable(): boolean {
	try {
		const result = spawnSync("rtk", ["--version"], {
			encoding: "utf-8",
			timeout: RTK_TIMEOUT_MS,
		});
		return result.status === 0;
	} catch {
		return false;
	}
}

function rewriteWithRtk(command: string): string | null {
	const cached = RTK_CACHE.get(command);
	if (cached !== undefined) {
		return cached;
	}

	try {
		const result = spawnSync("rtk", ["rewrite", command], {
			encoding: "utf-8",
			timeout: RTK_TIMEOUT_MS,
		});

		if (result.status !== 0 || result.error) {
			RTK_CACHE.set(command, null);
			return null;
		}

		const rewritten = result.stdout.trim();
		if (rewritten && rewritten !== command) {
			RTK_CACHE.set(command, rewritten);
			return rewritten;
		}

		RTK_CACHE.set(command, null);
		return null;
	} catch {
		RTK_CACHE.set(command, null);
		return null;
	}
}

export default function (pi: ExtensionAPI) {
	const rtkAvailable = checkRtkAvailable();

	pi.on("session_start", async (_event, ctx) => {
		if (rtkAvailable) {
			ctx.ui.notify("🪓 RTK active — CLI outputs will be compressed automatically", "success");
		}
	});

	pi.on("tool_call", async (event, _ctx) => {
		if (!rtkAvailable) return;
		if (event.toolName !== "bash") return;

		const command = event.input.command as string;

		// Skip if already rewritten or user explicitly used rtk
		if (command.trimStart().startsWith("rtk ")) return;

		// Skip shell builtins that rtk rewrite doesn't handle
		const firstWord = command.trimStart().split(/\s+/)[0];
		if (
			!firstWord ||
			firstWord === "cd" ||
			firstWord === "export" ||
			firstWord === "unset" ||
			firstWord === "source" ||
			firstWord === "." ||
			firstWord === "alias" ||
			firstWord === "type" ||
			firstWord === "which" ||
			firstWord === "whereis" ||
			firstWord === "echo" ||
			firstWord === "printf" ||
			firstWord === "cat" ||
			firstWord === "less" ||
			firstWord === "more"
		) {
			return;
		}

		const rewritten = rewriteWithRtk(command);
		if (rewritten) {
			REWRITE_TRACKER.set(event.toolCallId, { original: command, rewritten });
			event.input.command = rewritten;
		}
	});

	pi.on("tool_result", async (event, _ctx) => {
		const rewrite = REWRITE_TRACKER.get(event.toolCallId);
		if (!rewrite) return;
		REWRITE_TRACKER.delete(event.toolCallId);

		const note = `🪓 RTK rewrote: ${rewrite.original} → ${rewrite.rewritten}\n`;

		// Prepend the note to the first text block, or add one if none exists
		const firstText = event.content.find((c) => c.type === "text") as
			| { type: "text"; text: string }
			| undefined;

		if (firstText) {
			firstText.text = note + firstText.text;
		} else {
			event.content.unshift({ type: "text", text: note });
		}

		return { content: event.content };
	});

	// Clean up orphaned tracker entries (e.g. if another extension blocked the tool)
	pi.on("turn_end", async (_event, _ctx) => {
		REWRITE_TRACKER.clear();
	});

	pi.registerCommand("rtk", {
		description: "RTK integration: run 'rtk gain' or check status",
		handler: async (args, ctx) => {
			if (!rtkAvailable) {
				ctx.ui.notify("RTK is not installed or not in PATH. Install from https://rtk-ai.app", "error");
				return;
			}

			if (args.trim() === "gain") {
				try {
					const result = spawnSync("rtk", ["gain"], {
						encoding: "utf-8",
						timeout: 5000,
					});
					const output = result.stdout || result.stderr || "No output";
					ctx.ui.notify(output, "info");
				} catch {
					ctx.ui.notify("Failed to run 'rtk gain'", "error");
				}
			} else {
				const cacheSize = RTK_CACHE.size;
				ctx.ui.notify(
					`RTK is active. ${cacheSize} command pattern${cacheSize === 1 ? "" : "s"} cached. Use /rtk gain to see savings.`,
					"info",
				);
			}
		},
	});
}
