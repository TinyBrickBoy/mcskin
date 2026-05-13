import { getSkin, valid } from "$lib/rendering/mojang";
import { json } from "@sveltejs/kit";

export async function GET({ params }) {
	if (!params?.username || !valid(params.username)) {
		return json({ error: "Invalid or missing username" }, { status: 400 });
	}

	try {
		const skinURL = await getSkin(params.username);
		const response = await fetch(skinURL);
		if (!response.ok) throw new Error(`Skin fetch returned ${response.status}`);
		const blob = await response.arrayBuffer();
		if (!blob || blob.byteLength === 0) throw new Error("Empty skin payload");
		const contentType = response.headers.get("content-type") ?? "image/png";
		const buffer = `data:${contentType};base64,${Buffer.from(blob).toString("base64")}`;

		return json({ skin: buffer }, {
			headers: { "Cache-Control": "public, max-age=300" }
		});
	} catch (e) {
		return json({ message: "something went wrong", error: String(e) }, { status: 400 });
	}
}
