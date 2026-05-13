import { getSkin, valid } from "$lib/rendering/mojang";
import { json } from "@sveltejs/kit";

export async function GET({ params }) {
	if (!params?.username || !valid(params.username)) {
		return json({ error: "Invalid or missing username" }, { status: 400 });
	}

	try {
		const skinURL = await getSkin(params.username);
		const response = await fetch(skinURL);
		const blob = await response.arrayBuffer();
		const buffer = `data:${response.headers.get("content-type")};base64,${Buffer.from(blob).toString("base64")}`;

		return json({ skin: buffer }, {
			headers: { "Cache-Control": "public, max-age=300" }
		});
	} catch (e) {
		return json({ message: "something went wrong", error: String(e) }, { status: 400 });
	}
}
