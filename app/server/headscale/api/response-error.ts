// Represents an error that occurred during a response
// Thrown when status codes are >= 400
export default class ResponseError extends Error {
	status: number;
	response: string;
	requestUrl: string;
	responseObject?: Record<string, unknown>;

	constructor(status: number, response: string, requestUrl: string) {
		super(`${requestUrl}: status ${status} - ${response}`);
		this.name = 'ResponseError';
		this.status = status;
		this.response = response;
		this.requestUrl = requestUrl;

		try {
			// Try to parse the response as JSON to get a response object
			this.responseObject = JSON.parse(response);
		} catch {}
	}
}
