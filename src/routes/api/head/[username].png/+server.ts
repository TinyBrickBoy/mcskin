import { valid } from "$lib/rendering/mojang";
import { fetchSkinImage } from "$lib/rendering/skinImage";
import { Canvas } from "skia-canvas";
import { json } from "@sveltejs/kit";

// Cache fully rendered head PNGs. The head is tiny and the same
// (username, size, overlay) combination is requested over and over.
const HEAD_TTL_MS = 5 * 60 * 1000;
const MAX_HEADS = 2000;
type HeadEntry = { promise: Promise<Buffer>; expires: number };
const headCache = new Map<string, HeadEntry>();

function getCachedHead(key: string, build: () => Promise<Buffer>) {
	const now = Date.now();
	const cached = headCache.get(key);
	if (cached && cached.expires > now) return cached.promise;

	if (headCache.size >= MAX_HEADS) {
		const oldest = headCache.keys().next().value;
		if (oldest !== undefined) headCache.delete(oldest);
	}
	const promise = build().catch(err => {
		headCache.delete(key);
		throw err;
	});
	headCache.set(key, { promise, expires: now + HEAD_TTL_MS });
	return promise;
}

export async function GET({ params, url }) {
	if (!params?.username || !valid(params.username)) {
		return json({ error: "Invalid or missing username" }, { status: 400 });
	}

	const started = Date.now();
	const size = Math.min(512, Math.max(8, parseInt(url.searchParams.get("size") ?? "128")));
	const overlay = url.searchParams.get("overlay") !== "false";
	const key = `${params.username.toLowerCase()}|${size}|${overlay ? 1 : 0}`;

	try {
		let cacheHit = true;
		const buffer = await getCachedHead(key, async () => {
			cacheHit = false;
			const skinStart = Date.now();
			const skin = await fetchSkinImage(params.username) as any;
			const skinMs = Date.now() - skinStart;

			const renderStart = Date.now();
			const canvas = new Canvas(size, size);
			const ctx = canvas.getContext("2d");
			ctx.imageSmoothingEnabled = false;

			// Face (8,8 → 16,16 on skin)
			ctx.drawImage(skin, 8, 8, 8, 8, 0, 0, size, size);

			// Hat overlay (40,8 → 48,16 on skin)
			if (overlay) {
				ctx.drawImage(skin, 40, 8, 8, 8, 0, 0, size, size);
			}

			const png = await canvas.png;
			console.log(`[head] built ${key} skin=${skinMs}ms render=${Date.now() - renderStart}ms bytes=${png.length}`);
			return png;
		});

		console.log(`[head] ok ${key} cache=${cacheHit ? "hit" : "miss"} total=${Date.now() - started}ms`);
		return new Response(buffer, {
			status: 200,
			headers: {
				"Content-Type": "image/png",
				"Cache-Control": "public, max-age=300"
			}
		});
	} catch (e) {
		const err = e as any;
		console.error(
			`[head] fail ${key} total=${Date.now() - started}ms message=${err?.message ?? err} name=${err?.name ?? "?"} cause=${err?.cause?.message ?? err?.cause ?? "none"}`,
			err?.stack ?? ""
		);
		return json({ error: "Failed to render head" }, { status: 400 });
	}
}
