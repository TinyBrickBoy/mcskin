import { json } from "@sveltejs/kit";

export async function GET({ params }) {
	if (!params?.username) {
		return json({ error: "Missing username" }, { status: 400 });
	}

	try {
		const skinURL = await getSkin(params.username);
		const response = await fetch(skinURL);
		const blob = await response.arrayBuffer();
		const buffer = `data:${response.headers.get("content-type")};base64,${Buffer.from(blob).toString("base64")}`;

		return json({ skin: buffer });
	} catch (e) {
		return json({ message: "something went wrong", error: e }, { status: 400 });
	}

}

async function getSkin(username: string): Promise<string | never> {
	if (!valid(username)) return Promise.reject(`${username} is an invalid username`);
	const UUID = await getUUID(username);
	const response = await fetch(`http://172.18.0.1:4017/sessionserver.mojang.com/session/minecraft/profile/${UUID}`);
	if (!response.ok) return Promise.reject(`Response returned statuscode ${response.status}`);
	const json = await response.json();
	const r = JSON.parse(atob(json.properties[0].value));
	return r.textures.SKIN.url;
}

async function getUUID(username: string): Promise<string | never> {
	if (!valid(username)) return Promise.reject(`${username} is an invalid username`);
	const response = await fetch(`http://172.18.0.1:4017/api.mojang.com/users/profiles/minecraft/${username}`)
	if (!response.ok) return Promise.reject(`${username} does not exist`);
	const json = await response.json();
	return json.id;
}

function valid(username: string) {
	return username.match(/^[a-z0-9_]{1,16}$/i);
}
