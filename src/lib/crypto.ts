import { env } from "$env/dynamic/private"

export async function encryptCookie(cookieValue: string) {
	const password = env.COOKIE_SECRET;

	const salt = crypto.getRandomValues(new Uint8Array(16)); // Generate a random salt
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		{ name: "PBKDF2" },
		false,
		["deriveKey"]
	);

	const derivedKey = await crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: salt,
			iterations: 100000,
			hash: "SHA-256",
		},
		keyMaterial,
		{ name: "AES-CBC", length: 256 },
		false,
		["encrypt"]
	);

	const iv = crypto.getRandomValues(new Uint8Array(16));

	const encrypted = await crypto.subtle.encrypt(
		{
			name: "AES-CBC",
			iv: iv,
		},
		derivedKey,
		new TextEncoder().encode(cookieValue)
	);

	const combinedData = new Uint8Array(salt.byteLength + iv.byteLength + encrypted.byteLength);
	combinedData.set(salt, 0);
	combinedData.set(iv, salt.byteLength);
	combinedData.set(new Uint8Array(encrypted), salt.byteLength + iv.byteLength);
	const numberArray = Array.from(new Uint8Array(combinedData));

	return btoa(String.fromCharCode.apply(null, numberArray));
}

export async function decryptCookie(encryptedCookie: string) {
	const password = env.COOKIE_SECRET;
	const encryptedData = Uint8Array.from(atob(encryptedCookie), c => c.charCodeAt(0));
	const salt = encryptedData.slice(0, 16);
	const iv = encryptedData.slice(16, 32);
	const encrypted = encryptedData.slice(32);

	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		{ name: "PBKDF2" },
		false,
		["deriveKey"]
	);

	const derivedKey = await crypto.subtle.deriveKey(
		{
			name: "PBKDF2",
			salt: salt,
			iterations: 100000,
			hash: "SHA-256",
		},
		keyMaterial,
		{ name: "AES-CBC", length: 256 },
		false,
		["decrypt"]
	);

	const decrypted = await crypto.subtle.decrypt(
		{
			name: "AES-CBC",
			iv: iv,
		},
		derivedKey,
		encrypted
	);

	return new TextDecoder().decode(decrypted);
}

