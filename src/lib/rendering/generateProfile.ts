import { getSkin } from "./mojang";
import { loadImage } from "skia-canvas";
import { resolve } from "path";
const prefix = resolve("static");

// Static overlays are loaded exactly once and reused across all requests.
const shadingPromise = loadImage(`${prefix}/20x20pshading.png`);
const backdropPromise = loadImage(`${prefix}/backdropshading.png`);
const failedPromise = loadImage(`${prefix}/PFP/notFound.png`);

// Cache decoded skin images per URL – avoids re-decoding the PNG on every render.
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
		}
	}
	throw lastError;
}

async function generatePfp(username: string, ctx: any) {
	try {
		if (!username) {
			await drawFailed(ctx);
			return;
		}

		const [skinImage, shading, backdrop] = await Promise.all([
			fetchSkinImage(username),
			shadingPromise,
			backdropPromise,
		]) as any[];

		ctx.drawImage(backdrop, 0, 0, 20, 20);

		if (skinImage.height === 32) {
			ctx.drawImage(skinImage, 8, 9, 7, 7, 8, 4, 7, 7); // Head (bottom layer)
			ctx.drawImage(skinImage, 5, 9, 3, 7, 5, 4, 3, 7); // Head Side (bottom layer)
			ctx.drawImage(skinImage, 44, 20, 3, 7, 12, 13, 3, 7); // Arm Right Side (bottom layer)
			ctx.drawImage(skinImage, 21, 20, 6, 1, 7, 11, 6, 1); // Chest Neck Small Line (bottom layer)
			ctx.drawImage(skinImage, 20, 21, 8, 8, 6, 12, 8, 8); // Chest Other (Bottom layer)
			ctx.drawImage(skinImage, 44, 20, 3, 7, 5, 13, 3, 7); // Arm Left Side (bottom layer)
			ctx.drawImage(skinImage, 40, 9, 7, 7, 8, 4, 7, 7); // Head (top layer)
			ctx.drawImage(skinImage, 33, 9, 3, 7, 5, 4, 3, 7); // Head Side (top layer)

		} else {
			// * BOTTOM LAYER
			ctx.drawImage(skinImage, 8, 9, 7, 7, 8, 4, 7, 7); // Head (bottom layer)
			ctx.drawImage(skinImage, 5, 9, 3, 7, 5, 4, 3, 7); // Head Side (bottom layer)
			ctx.drawImage(skinImage, 36, 52, 3, 7, 12, 13, 3, 7); // Arm Right Side (bottom layer)
			ctx.drawImage(skinImage, 21, 20, 6, 1, 7, 11, 6, 1); // Chest Neck Small Line (bottom layer)
			ctx.drawImage(skinImage, 20, 21, 8, 8, 6, 12, 8, 8); // Chest Other (Bottom layer)
			ctx.drawImage(skinImage, 44, 20, 3, 7, 5, 13, 3, 7); // Arm Left Side (bottom layer)

			// * TOP LAYER
			ctx.drawImage(skinImage, 40, 9, 7, 7, 8, 4, 7, 7); // Head (top layer)
			ctx.drawImage(skinImage, 33, 9, 3, 7, 5, 4, 3, 7); // Head Side (top layer)
			ctx.drawImage(skinImage, 52, 52, 3, 7, 12, 13, 3, 7); // Arm Right Side (top layer)
			ctx.drawImage(skinImage, 52, 36, 3, 7, 5, 13, 3, 7); // Arm Left Side (top layer)
			ctx.drawImage(skinImage, 20, 37, 8, 8, 6, 12, 8, 8); // Chest Other (top layer)
			ctx.drawImage(skinImage, 21, 36, 6, 1, 7, 11, 6, 1); // Chest Neck Small Line (top layer)
		}

		ctx.drawImage(shading, 0, 0, 20, 20);
	} catch (e) {
		await drawFailed(ctx);
	}
}

async function drawFailed(ctx) {
	const [failed, shading, backdrop] = await Promise.all([
		failedPromise,
		shadingPromise,
		backdropPromise,
	]);

	ctx.drawImage(backdrop, 0, 0, 20, 20);
	ctx.resetTransform();
	ctx.drawImage(failed, 0, 0, 300, 300);
	ctx.scale(16, 16);
	ctx.drawImage(shading, 0, 0, 20, 20);
}

export default generatePfp
