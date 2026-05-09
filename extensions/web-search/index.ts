import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { Text } from "@earendil-works/pi-tui";
import { parseHTML } from "linkedom";

// ── Types ────────────────────────────────────────────────────────────

interface SearchResult {
	title: string;
	url: string;
	snippet: string;
}

interface StructuredSearchArgs {
	query?: string;
	exactPhrases?: string[];
	excludeTerms?: string[];
	site?: string;
	count?: number;
}

interface BuiltSearchQuery {
	query: string;
	baseQuery?: string;
	exactPhrases: string[];
	excludeTerms: string[];
	site?: string;
}

// ── Constants ────────────────────────────────────────────────────────

const USER_AGENT =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
const SEARCH_TIMEOUT_MS = 15000;

// ── Query Builders ───────────────────────────────────────────────────

function stripWrappingQuotes(value: string): string {
	return value.length >= 2 && value.startsWith('"') && value.endsWith('"')
		? value.slice(1, -1).trim()
		: value;
}

function cleanItems(values?: string[]): string[] {
	if (!values) return [];
	return values
		.map((value) => stripWrappingQuotes(value.trim().replace(/\s+/g, " ")))
		.filter(Boolean);
}

function cleanQuery(value?: string): string | undefined {
	if (typeof value !== "string") return undefined;
	const cleaned = value.trim().replace(/\s+/g, " ");
	return cleaned || undefined;
}

function normalizeSite(site?: string): string | undefined {
	if (typeof site !== "string") return undefined;
	let value = site.trim().replace(/^site:/i, "").trim();
	if (!value) return undefined;
	try {
		const candidate = /^[a-z]+:\/\//i.test(value)
			? value
			: `https://${value}`;
		const url = new URL(candidate);
		if (url.hostname) value = url.hostname;
	} catch {}
	return value.replace(/\/+$/, "") || undefined;
}

function quoteForSearch(value: string): string {
	return `"${value.replace(/"/g, '\\"')}"`;
}

function buildSearchQuery(args: StructuredSearchArgs): BuiltSearchQuery {
	const baseQuery = cleanQuery(args.query);
	const exactPhrases = cleanItems(args.exactPhrases);
	const excludeTerms = cleanItems(args.excludeTerms);
	const site = normalizeSite(args.site);

	if (!baseQuery && exactPhrases.length === 0) {
		throw new Error(
			"At least one of 'query' or 'exactPhrases' is required.",
		);
	}

	const parts: string[] = [];
	if (baseQuery) parts.push(baseQuery);
	for (const phrase of exactPhrases) {
		parts.push(quoteForSearch(phrase));
	}
	for (const term of excludeTerms) {
		parts.push(`-${term.includes(" ") ? quoteForSearch(term) : term}`);
	}
	if (site) {
		parts.push(`site:${site}`);
	}

	return {
		query: parts.join(" "),
		baseQuery,
		exactPhrases,
		excludeTerms,
		site,
	};
}

function formatResults(results: SearchResult[]): string {
	if (results.length === 0) return "No results found.";
	return results
		.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
		.join("\n\n");
}

function resolveUrl(base: string, href: string): string {
	if (!href) return "";
	if (/^[a-z]+:\/\//i.test(href)) return href;
	try {
		return new URL(href, base).toString();
	} catch {
		return href;
	}
}

function makeSearchSignal(
	signal?: AbortSignal,
	ms = SEARCH_TIMEOUT_MS,
): AbortSignal {
	const timeout = AbortSignal.timeout(ms);
	return signal ? AbortSignal.any([timeout, signal]) : timeout;
}

// ── Search Providers ─────────────────────────────────────────────────

async function searchBrave(
	query: string,
	count: number,
	signal?: AbortSignal,
): Promise<SearchResult[] | null> {
	const url = new URL("https://search.brave.com/search");
	url.searchParams.set("q", query);

	try {
		const resp = await fetch(url.toString(), {
			signal: makeSearchSignal(signal),
			headers: {
				"User-Agent": USER_AGENT,
				Accept:
					"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				"Accept-Language": "en-US,en;q=0.9",
				"Accept-Encoding": "gzip, deflate, br",
				"Cache-Control": "no-cache",
			},
		});
		if (!resp.ok) return null;

		const html = await resp.text();
		const { document } = parseHTML(html);

		const results: SearchResult[] = [];
		const items = document.querySelectorAll('.snippet[data-type="web"]');

		for (const item of items) {
			const linkEl = item.querySelector("a.l1");
			if (!linkEl) continue;

			const href = resolveUrl(
				url.toString(),
				linkEl.getAttribute("href") || "",
			);
			const titleEl = item.querySelector(".search-snippet-title");
			const title =
				titleEl?.getAttribute("title")?.trim() ||
				titleEl?.textContent?.trim() ||
				"";

			let snippet = "";
			const contentEl = item.querySelector(".generic-snippet .content");
			if (contentEl) {
				const clone = contentEl.cloneNode(true) as Element;
				clone.querySelectorAll(".t-secondary").forEach((el) => el.remove());
				snippet = clone.textContent?.trim() || "";
			}

			if (href && title) {
				results.push({ title, url: href, snippet });
			}
			if (results.length >= count) break;
		}

		return results.length > 0 ? results : null;
	} catch {
		return null;
	}
}

async function searchBing(
	query: string,
	count: number,
	signal?: AbortSignal,
): Promise<SearchResult[] | null> {
	const url = new URL("https://www.bing.com/search");
	url.searchParams.set("q", query);
	url.searchParams.set("count", String(Math.min(count + 5, 50)));

	try {
		const resp = await fetch(url.toString(), {
			signal: makeSearchSignal(signal),
			headers: {
				"User-Agent": USER_AGENT,
				Accept:
					"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				"Accept-Language": "en-US,en;q=0.9",
				"Accept-Encoding": "gzip, deflate, br",
				"Cache-Control": "no-cache",
			},
		});
		if (!resp.ok) return null;

		const html = await resp.text();
		const { document } = parseHTML(html);

		const results: SearchResult[] = [];
		const items = document.querySelectorAll(".b_algo");

		for (const item of items) {
			const linkEl = item.querySelector("h2 a");
			if (!linkEl) continue;

			const href = resolveUrl(
				url.toString(),
				linkEl.getAttribute("href") || "",
			);
			const title = linkEl.textContent?.trim() || "";

			const snippetEl = item.querySelector(".b_caption p");
			const snippet = snippetEl?.textContent?.trim() || "";

			if (href && title) {
				results.push({ title, url: href, snippet });
			}
			if (results.length >= count) break;
		}

		return results.length > 0 ? results : null;
	} catch {
		return null;
	}
}

async function searchDuckDuckGo(
	query: string,
	count: number,
	signal?: AbortSignal,
): Promise<SearchResult[] | null> {
	const url = new URL("https://html.duckduckgo.com/html/");
	url.searchParams.set("q", query);

	try {
		const resp = await fetch(url.toString(), {
			signal: makeSearchSignal(signal),
			headers: {
				"User-Agent": USER_AGENT,
				Accept:
					"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
				"Accept-Language": "en-US,en;q=0.9",
			},
		});
		if (!resp.ok) return null;

		const html = await resp.text();
		if (
			html.includes("anomaly") ||
			html.includes("Unfortunately, bots use")
		) {
			return null;
		}

		const { document } = parseHTML(html);

		const results: SearchResult[] = [];
		const items = document.querySelectorAll(".result");

		for (const item of items) {
			const linkEl = item.querySelector(".result__a");
			if (!linkEl) continue;

			const href = resolveUrl(
				url.toString(),
				linkEl.getAttribute("href") || "",
			);
			const title = linkEl.textContent?.trim() || "";

			const snippetEl = item.querySelector(".result__snippet");
			const snippet = snippetEl?.textContent?.trim() || "";

			if (href && title) {
				results.push({ title, url: href, snippet });
			}
			if (results.length >= count) break;
		}

		return results.length > 0 ? results : null;
	} catch {
		return null;
	}
}

async function performSearch(
	query: string,
	count: number,
	signal?: AbortSignal,
): Promise<{ results: SearchResult[]; provider: string }> {
	const brave = await searchBrave(query, count, signal);
	if (brave && brave.length > 0) {
		return { results: brave, provider: "brave" };
	}

	const bing = await searchBing(query, count, signal);
	if (bing && bing.length > 0) {
		return { results: bing, provider: "bing" };
	}

	const ddg = await searchDuckDuckGo(query, count, signal);
	if (ddg && ddg.length > 0) {
		return { results: ddg, provider: "duckduckgo" };
	}

	return { results: [], provider: "none" };
}

// ── Extension Registration ───────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "web_search",
		label: "Web Search",
		description:
			"Search the web via Brave, Bing, or DuckDuckGo. Build one search per call from a base query string, exact phrases, exclusions, and an optional site. Returns title, URL, and snippet.",
		promptSnippet:
			"Search the web via a query string plus optional exactPhrases, excludeTerms, and site. Use one tool call per search angle.",
		promptGuidelines: [
			"Use exactPhrases for exact phrase matching instead of embedding quote marks inside the main query string.",
			"Use one web_search tool call per search angle instead of batching multiple searches into one call.",
		],

		parameters: Type.Object({
			query: Type.Optional(
				Type.String({
					description:
						"Base search query as a normal string. Prefer this for the main search wording.",
				}),
			),
			exactPhrases: Type.Optional(
				Type.Array(Type.String(), {
					description:
						"Exact phrases to match. Each item becomes a quoted phrase in the final search query.",
				}),
			),
			excludeTerms: Type.Optional(
				Type.Array(Type.String(), {
					description:
						"Terms or phrases to exclude. Multi-word items are excluded as exact phrases.",
				}),
			),
			site: Type.Optional(
				Type.String({
					description:
						"Optional site/domain restriction, such as example.com or a full URL.",
				}),
			),
			count: Type.Optional(
				Type.Number({
					description:
						"Number of results to return (default: 5, max: 10)",
					minimum: 1,
					maximum: 10,
				}),
			),
		}),

		async execute(_toolCallId, params: StructuredSearchArgs, signal) {
			const count = params.count ?? 5;
			const built = buildSearchQuery(params);
			const { results, provider } = await performSearch(
				built.query,
				count,
				signal,
			);

			return {
				content: [
					{
						type: "text" as const,
						text: formatResults(results),
					},
				],
				details: {
					composedQuery: built.query,
					query: built.baseQuery,
					exactPhrases: built.exactPhrases,
					excludeTerms: built.excludeTerms,
					site: built.site,
					resultCount: results.length,
					provider,
				},
			};
		},

		renderCall(args, theme, context) {
			const text =
				(context.lastComponent as Text | undefined) ??
				new Text("", 0, 0);
			const { count, ...searchArgs } = args as StructuredSearchArgs;

			try {
				const built = buildSearchQuery(searchArgs);
				const display =
					built.query.length > 70
						? built.query.slice(0, 67) + "..."
						: built.query;
				const lines = [
					theme.fg("toolTitle", theme.bold("search ")) +
						theme.fg("accent", `"${display}"`),
				];
				if (count && count !== 5) {
					lines.push(theme.fg("dim", `  count: ${count}`));
				}
				text.setText(lines.join("\n"));
				return text;
			} catch {
				text.setText(
					theme.fg("toolTitle", theme.bold("search ")) +
						theme.fg("error", "(invalid query)"),
				);
				return text;
			}
		},

		renderResult(result, { expanded, isPartial }, theme, context) {
			const text =
				(context.lastComponent as Text | undefined) ??
				new Text("", 0, 0);

			if (isPartial) {
				text.setText(theme.fg("warning", "Searching…"));
				return text;
			}

			if (context.isError) {
				const msg =
					result.content.find((c) => c.type === "text")?.text ||
					"Error";
				text.setText(theme.fg("error", msg));
				return text;
			}

			const details = result.details as {
				composedQuery?: string;
				resultCount?: number;
				provider?: string;
			};
			const providerLabel =
				details?.provider && details.provider !== "none"
					? ` via ${details.provider}`
					: "";
			const status = theme.fg(
				"success",
				`${details?.resultCount ?? 0} results${providerLabel}`,
			);
			if (!expanded) {
				text.setText(status);
				return text;
			}

			const content =
				result.content.find((c) => c.type === "text")?.text || "";
			const preview =
				content.length > 500
					? content.slice(0, 500) + "..."
					: content;
			const queryLine = details?.composedQuery
				? theme.fg("dim", `query: ${details.composedQuery}`)
				: "";
			text.setText(
				[status, queryLine, theme.fg("dim", preview)]
					.filter(Boolean)
					.join("\n"),
			);
			return text;
		},
	});
}
