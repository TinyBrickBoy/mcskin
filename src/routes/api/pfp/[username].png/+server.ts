import generatePfp from "$lib/rendering/generateProfile";
import changeGradient from "$lib/rendering/gradient";
import { Canvas } from "skia-canvas";
import { json } from "@sveltejs/kit";

export async function GET({ params, url }) {
	if (!params?.username) {
		return json({ error: "Missing username" }, { status: 400 });
	}

	try {
		const username = params.username;

		const searchParams = url.searchParams;
		const gradient = searchParams.get("gradient");
		const transparent = searchParams.get("transparent") === "true";
		const colours = gradient ? gradient.split("-").filter(v => v !== "").map(colour => `#${colour}`) : null;

		const canvas = new Canvas(300, 300);
		const ctx = canvas.getContext("2d");
		ctx.scale(16, 16)
		ctx.imageSmoothingEnabled = false;

		if (!transparent) {
			changeGradient(ctx, colours)
		}
		await generatePfp(username, ctx);

		const dataURL = await canvas.png;
		return new Response(dataURL, {
			status: 200,
			headers: {
				"Content-Type": "image/png",
				"Cache-Control": "public, max-age=300"
			}
		});

	} catch (e) {
		console.log(e)
		return json({ message: "oops" }, { status: 400 });
	}
}
