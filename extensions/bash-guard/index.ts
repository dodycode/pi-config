import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";
import { parse as shellParse } from "shell-quote";
import * as os from "os";
import * as path from "path";

type OpToken = { op: string; file?: string; [k: string]: unknown };
type Token = string | OpToken;

type Verdict = { kind: "silent" } | { kind: "prompt"; reason: string };

const HOME = os.homedir();

const READ_ONLY_COMMANDS = new Set([
	"cat", "less", "more", "head", "tail", "bat",
	"ls", "ll", "la", "tree", "lsof", "ps", "top", "htop", "lsblk",
	"grep", "rg", "egrep", "fgrep", "ack",
	"find",
	"wc", "du", "df", "stat", "file",
	"pwd", "echo", "printf", "whoami", "id", "uname", "hostname", "date",
	"env", "printenv",
	"which", "whereis", "type", "command",
	"realpath", "readlink", "basename", "dirname",
]);

const READ_ONLY_GIT_SUBCOMMANDS = new Set([
	"status", "log", "diff", "show", "blame",
	"ls-files", "ls-tree", "ls-remote",
	"rev-parse", "rev-list",
	"describe",
	"shortlog", "whatchanged",
	"fsck", "count-objects", "verify-pack",
]);

const PIPE_TARGET_SHELLS = new Set(["sh", "bash", "zsh", "fish", "dash", "ash"]);

function isOpToken(t: Token): t is OpToken {
	return typeof t === "object" && t !== null && "op" in t;
}

function tokensToStrings(tokens: Token[]): string[] {
	return tokens.filter((t): t is string => typeof t === "string");
}

function splitOnOps(tokens: Token[], splitOps: string[]): Token[][] {
	const out: Token[][] = [];
	let current: Token[] = [];
	for (const t of tokens) {
		if (isOpToken(t) && splitOps.includes(t.op)) {
			if (current.length) out.push(current);
			current = [];
			continue;
		}
		current.push(t);
	}
	if (current.length) out.push(current);
	return out;
}

function looksLikePath(arg: string): boolean {
	if (/^-/.test(arg)) return false;
	if (/^https?:\/\//.test(arg)) return false;
	if (/^[a-zA-Z][\w+.-]*:\/\//.test(arg)) return false;
	if (/^[\w.-]+@[\w.-]+:/.test(arg)) return false;
	return arg === "." || arg === ".." || arg.startsWith("/") || arg.startsWith("~") || arg.startsWith("./") || arg.startsWith("../");
}

function resolvePath(p: string): string {
	if (p.startsWith("~")) return path.join(HOME, p.slice(1));
	if (path.isAbsolute(p)) return p;
	return path.join(process.cwd(), p);
}

function isInDir(p: string, dir: string): boolean {
	const resolved = path.resolve(resolvePath(p));
	const resolvedDir = path.resolve(dir);
	return resolved === resolvedDir || resolved.startsWith(resolvedDir + path.sep);
}

function isCwdInHome(): boolean {
	const cwd = process.cwd();
	return cwd === HOME || cwd.startsWith(HOME + path.sep);
}

function extractPaths(seg: Token[]): { paths: string[]; hasWriteRedirect: boolean } {
	const paths: string[] = [];
	let hasWriteRedirect = false;
	const args = tokensToStrings(seg);
	for (let i = 1; i < args.length; i++) {
		if (looksLikePath(args[i])) paths.push(args[i]);
	}
	for (let i = 0; i < seg.length; i++) {
		const t = seg[i];
		if (!isOpToken(t)) continue;
		if (t.op === ">" || t.op === ">>" || t.op === "2>" || t.op === "2>>") {
			hasWriteRedirect = true;
			if (typeof t.file === "string") {
				paths.push(t.file);
				continue;
			}
			const next = seg[i + 1];
			if (typeof next === "string") paths.push(next);
		}
	}
	return { paths, hasWriteRedirect };
}

function alwaysPromptReason(cmd: string, sub: string | undefined, rest: string[]): string | null {
	if (cmd === "rm" || cmd === "rmdir" || cmd === "unlink") return `${cmd} (file deletion)`;
	if (cmd === "find" && rest.includes("-delete")) return "find -delete (bulk deletion)";

	if (cmd === "git") {
		if (sub === "rm") return "git rm (removes files from working tree)";
		if (sub === "clean" && rest.some((a) => /^-[a-zA-Z]*f/.test(a))) return "git clean -f (delete untracked files)";
		if (sub === "reset" && rest.includes("--hard")) return "git reset --hard (discard changes)";
		if (sub === "push" && (rest.includes("--force") || rest.includes("--force-with-lease") || rest.includes("-f"))) return "git push --force (rewrite remote history)";
		if (sub === "reflog" && rest.includes("expire")) return "git reflog expire (remove recovery history)";
		if (sub === "gc" && rest.some((a) => a.startsWith("--prune"))) return "git gc --prune (permanently delete objects)";
	}

	if (cmd === "sudo") return "sudo (elevated privileges)";

	if (cmd.startsWith("mkfs")) return "mkfs (filesystem formatting)";
	if (cmd.startsWith("newfs_")) return "newfs_* (filesystem formatting)";
	if (cmd === "wipefs") return "wipefs (disk signature wipe)";
	if (cmd === "parted" || cmd === "fdisk" || cmd === "gdisk" || cmd === "sgdisk") return `${cmd} (partition table)`;
	if (cmd === "cryptsetup") return "cryptsetup (disk encryption)";
	if (cmd === "diskutil" && rest.some((a) => /^(erase|zeroDisk|secureErase|reformat)/i.test(a))) return "diskutil erase (destructive disk op)";
	if (cmd === "pvcreate" || cmd === "vgcreate" || cmd === "lvcreate") return `${cmd} (LVM volume management)`;
	if (cmd === "zpool") return "zpool (ZFS pool management)";
	if (cmd === "dd" && rest.some((a) => a.startsWith("of=/dev/"))) return "dd of=/dev/* (raw disk write)";

	if (cmd === "shutdown" || cmd === "reboot" || cmd === "halt" || cmd === "poweroff") return `${cmd} (system power op)`;

	if (cmd === "terraform" && sub === "destroy") return "terraform destroy (infrastructure teardown)";
	if (cmd === "kubectl" && sub === "delete") return "kubectl delete (Kubernetes resource deletion)";
	if (cmd === "aws" && rest[0] === "s3" && rest[1] === "rm" && rest.includes("--recursive")) return "aws s3 rm --recursive (bulk S3 deletion)";
	if (cmd === "gcloud" && rest.includes("delete")) return "gcloud delete (cloud resource deletion)";

	return null;
}

function pipeToShellReason(tokens: Token[]): string | null {
	const pieces = splitOnOps(tokens, ["|"]);
	if (pieces.length < 2) return null;
	const sourceArgs = tokensToStrings(pieces[0]);
	const source = sourceArgs[0];
	if (source !== "curl" && source !== "wget") return null;
	for (let i = 1; i < pieces.length; i++) {
		const target = tokensToStrings(pieces[i])[0];
		if (target && PIPE_TARGET_SHELLS.has(target)) {
			return "curl|sh / wget|sh (pipe to shell — remote code execution)";
		}
	}
	return null;
}

function isReadOnlyCommand(cmd: string, sub: string | undefined): boolean {
	if (READ_ONLY_COMMANDS.has(cmd)) return true;
	if (cmd === "git" && sub && READ_ONLY_GIT_SUBCOMMANDS.has(sub)) return true;
	return false;
}

function decideSegment(seg: Token[]): Verdict {
	const args = tokensToStrings(seg);
	const cmd = args[0];
	if (!cmd) return { kind: "silent" };
	const sub = args[1];
	const rest = args.slice(1);

	const { paths, hasWriteRedirect } = extractPaths(seg);

	if (paths.length > 0 && paths.every((p) => isInDir(p, "/tmp"))) {
		return { kind: "silent" };
	}

	const reason = alwaysPromptReason(cmd, sub, rest);
	if (reason) return { kind: "prompt", reason };

	if (isReadOnlyCommand(cmd, sub) && !hasWriteRedirect) {
		return { kind: "silent" };
	}

	if (isCwdInHome()) {
		if (paths.length === 0) return { kind: "silent" };
		if (paths.every((p) => isInDir(p, HOME) || isInDir(p, "/tmp"))) {
			return { kind: "silent" };
		}
	}

	const detail = hasWriteRedirect ? "writes to a path outside $HOME" : "writes/touches a path outside $HOME";
	return { kind: "prompt", reason: `${cmd} ${detail}` };
}

function decideCommand(command: string): Verdict {
	let tokens: Token[];
	try {
		tokens = shellParse(command) as Token[];
	} catch {
		return { kind: "prompt", reason: "shell command could not be parsed safely" };
	}

	const pipeReason = pipeToShellReason(tokens);
	if (pipeReason) return { kind: "prompt", reason: pipeReason };

	const segments = splitOnOps(tokens, ["&&", "||", ";", "|"]);
	if (segments.length === 0) return { kind: "silent" };

	const reasons: string[] = [];
	for (const seg of segments) {
		const v = decideSegment(seg);
		if (v.kind === "prompt") reasons.push(v.reason);
	}

	if (reasons.length === 0) return { kind: "silent" };
	return { kind: "prompt", reason: [...new Set(reasons)].join("; ") };
}

const subagentDepth = Number(process.env.PI_SUBAGENT_DEPTH ?? "0");
const isSubagent = Number.isFinite(subagentDepth) && subagentDepth >= 1;

async function promptRunOrAbort(ctx: any, reason: string): Promise<"run" | "abort"> {
	if (!ctx.hasUI) return "abort";
	const title = `Bash command needs confirmation — ${reason}`;
	const choice = await ctx.ui.select(title, ["Run", "Abort"]);
	return choice === "Run" ? "run" : "abort";
}

export default function (pi: ExtensionAPI) {
	pi.registerFlag("bash-guard-auto-allow", {
		description: "If set, bash-guard will allow flagged commands when no UI is available (non-interactive modes).",
		type: "boolean",
		default: false,
	});

	pi.on("tool_call", async (event, ctx) => {
		if (!isToolCallEventType("bash", event)) return;

		const command = event.input.command;
		const verdict = decideCommand(command);
		if (verdict.kind === "silent") return;

		if (isSubagent) {
			return {
				block: true,
				reason:
					`Blocked by bash-guard: ${verdict.reason}. ` +
					"This is a non-interactive subagent session. Propose a safer alternative or ask the parent agent to confirm with the user.",
			};
		}

		if (!ctx?.hasUI && pi.getFlag("--bash-guard-auto-allow")) return;

		const choice = await promptRunOrAbort(ctx, verdict.reason);
		if (choice === "run") return;

		return {
			block: true,
			reason: `Blocked by user via bash-guard: ${verdict.reason}. Ask the user before retrying or propose a non-destructive alternative.`,
		};
	});
}
