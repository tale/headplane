// Represents an error that occurred during a response
// Thrown when status codes are >= 400
export default class ResponseError extends Error {
	status: number;
	response: string;
	responseObject?: Record<string, unknown>;

	constructor(status: number, response: string) {
		super(`Response Error (${status}): ${response}`);
		this.name = 'ResponseError';
		this.status = status;
		this.response = response;

		try {
			// Try to parse the response as JSON to get a response object
			this.responseObject = JSON.parse(response);
		} catch {}
	}
}
