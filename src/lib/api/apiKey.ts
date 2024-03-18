import { post } from ".";

export async function generateApiKey(exp: number, key: string) {
	const expDate = new Date(exp * 1000).toISOString();
	const response = await post<{ apiKey: string }>('v1/apikey', key, {
		expiration: expDate
	});

	return response.apiKey;
}
