import { loadImage } from "skia-canvas";
import { getSkin } from "./mojang";

const SKIN_IMAGE_TTL_MS = 5 * 60 * 1000;
const MAX_SKIN_IMAGES = 1000;

type SkinEntry = { promise: Promise<unknown>; expires: number };
const skinImageCache = new Map<string, SkinEntry>();

function getSkinImage(url: string) {
	const now = Date.now();
	const cached = skinImageCache.get(url);
	if (cached && cached.expires > now) return cached.promise;

	if (skinImageCache.size >= MAX_SKIN_IMAGES) {
		const oldest = skinImageCache.keys().next().value;
		if (oldest !== undefined) skinImageCache.delete(oldest);
	}
	const promise = loadImage(url).catch(err => {
		skinImageCache.delete(url);
		throw err;
	});
	skinImageCache.set(url, { promise, expires: now + SKIN_IMAGE_TTL_MS });
	return promise;
}

async function fetchSkinImage(username: string) {
	let lastError: unknown;
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			const skinURL = await getSkin(username);
			return await getSkinImage(skinURL);
		} catch (e) {
			lastError = e;
			const err = e as any;
			console.warn(`[skinImage] attempt ${attempt + 1}/3 failed for ${username}: ${err?.message ?? err}`);
		}
	}
	throw lastError;
}

export { getSkinImage, fetchSkinImage };
