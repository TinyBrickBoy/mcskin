const MOJANG_PROXY = "http://172.18.0.1:4017";
const UUID_TTL_MS = 6 * 60 * 60 * 1000;   // 6h – usernames -> uuid mappings are very stable
const SKIN_TTL_MS = 5 * 60 * 1000;        // 5min – skin url can change when player updates skin
const MAX_CACHE_ENTRIES = 5000;

type CacheEntry<T> = { value: T; expires: number };

const uuidCache = new Map<string, CacheEntry<string>>();
const skinCache = new Map<string, CacheEntry<string>>();
const uuidInflight = new Map<string, Promise<string>>();
const skinInflight = new Map<string, Promise<string>>();

function cacheGet<T>(map: Map<string, CacheEntry<T>>, key: string): T | undefined {
	const entry = map.get(key);
	if (!entry) return undefined;
	if (entry.expires <= Date.now()) {
		map.delete(key);
		return undefined;
	}
	return entry.value;
}

function cacheSet<T>(map: Map<string, CacheEntry<T>>, key: string, value: T, ttl: number) {
	if (map.size >= MAX_CACHE_ENTRIES) {
		const oldest = map.keys().next().value;
		if (oldest !== undefined) map.delete(oldest);
	}
	map.set(key, { value, expires: Date.now() + ttl });
}

async function getUUID(username: string): Promise<string | never> {
	if (!valid(username)) return Promise.reject(`${username} is an invalid username`);
	const key = username.toLowerCase();

	const cached = cacheGet(uuidCache, key);
	if (cached) return cached;

	const existing = uuidInflight.get(key);
	if (existing) return existing;

	const p = (async () => {
		const response = await fetch(`${MOJANG_PROXY}/api.mojang.com/users/profiles/minecraft/${username}`);
		if (!response.ok) throw new Error(`${username} does not exist`);
		const json = await response.json();
		cacheSet(uuidCache, key, json.id as string, UUID_TTL_MS);
		return json.id as string;
	})();
	uuidInflight.set(key, p);
	try {
		return await p;
	} finally {
		uuidInflight.delete(key);
	}
}

async function getSkin(username: string): Promise<string | never> {
	if (!valid(username)) return Promise.reject(`${username} is an invalid username`);
	const uuid = await getUUID(username);

	const cached = cacheGet(skinCache, uuid);
	if (cached) return cached;

	const existing = skinInflight.get(uuid);
	if (existing) return existing;

	const p = (async () => {
		const response = await fetch(`${MOJANG_PROXY}/sessionserver.mojang.com/session/minecraft/profile/${uuid}`);
		if (!response.ok) throw new Error(`Response returned statuscode ${response.status}`);
		const json = await response.json();
		const prop = json?.properties?.[0]?.value;
		if (!prop) throw new Error(`No texture property for ${uuid}`);
		const decoded = JSON.parse(atob(prop));
		const url = decoded?.textures?.SKIN?.url as string | undefined;
		if (!url) throw new Error(`No skin set for ${uuid}`);
		cacheSet(skinCache, uuid, url, SKIN_TTL_MS);
		return url;
	})();
	skinInflight.set(uuid, p);
	try {
		return await p;
	} finally {
		skinInflight.delete(uuid);
	}
}

function valid(username: string) {
	return username.match(/^[a-z0-9_]{1,16}$/i);
}

export {
	getSkin,
	getUUID,
	valid
}
