// Refer to agent/internal/sshutil/encoder.go for more details
// This is the Node.js implementation of the SSH encoder
import log from '~/utils/log';

const MAGIC = 'HPLS';
const VERSION = 1;

// 0 -> Stdin
// 1 -> Stdout
// 2 -> Stderr
export type ChannelType = 0 | 1 | 2;

interface SSHFrame {
	sessionId: string;
	channel: ChannelType;
	payload: Blob | ArrayBufferLike | string;
}

export async function encodeSSHFrame(frame: SSHFrame) {
	const sid = Buffer.from(frame.sessionId, 'utf8');
	if (sid.length > 255) {
		log.error('agent', 'SSH session ID too long: %s', frame.sessionId);
		return;
	}

	const payload = Buffer.isBuffer(frame.payload)
		? frame.payload
		: typeof frame.payload === 'string'
			? Buffer.from(frame.payload, 'utf8')
			: frame.payload instanceof Blob
				? Buffer.from(await frame.payload.arrayBuffer())
				: Buffer.from(frame.payload);

	// Size can only hold 4 bytes
	if (payload.length > 0xffffffff) {
		log.error('agent', 'SSH payload too large: %d bytes', payload.length);
		return;
	}

	const frameSize =
		4 + // Magic
		1 + // Version
		1 + // Channel Type
		(1 + sid.length) + // Session ID length + SID
		(4 + payload.length); // Payload length + Payload

	const buf = Buffer.alloc(frameSize);
	buf.write(MAGIC, 0, 'utf8');
	buf.writeUInt8(VERSION, 4);
	buf.writeUInt8(frame.channel, 5);
	buf.writeUInt8(sid.length, 6);

	const offset = 7 + sid.length;
	sid.copy(buf, 7);

	buf.writeUInt32BE(payload.length, offset);
	payload.copy(buf, offset + 4);
	return buf;
}

export function decodeSSHFrame(data: Buffer) {
	if (data.length < 5) {
		log.error('agent', 'SSH frame too short: %d bytes', data.length);
		return;
	}

	const magic = data.toString('utf8', 0, 4);
	const version = data.readUInt8(4);

	if (magic !== MAGIC || version !== VERSION) {
		log.error('agent', 'Invalid SSH frame magic or version');
		return;
	}

	const channel = data.readUInt8(5) as ChannelType;
	const sidLength = data.readUInt8(6);
	if (data.length < 7 + sidLength + 4) {
		log.error('agent', 'SSH frame too short for session ID and payload');
		return;
	}

	const sessionId = data.toString('utf8', 7, 7 + sidLength);
	const payloadLength = data.readUInt32BE(7 + sidLength);
	if (data.length < 7 + sidLength + 4 + payloadLength) {
		log.error('agent', 'SSH frame too short for payload');
		return;
	}

	const payload = data.subarray(
		7 + sidLength + 4,
		7 + sidLength + 4 + payloadLength,
	);

	return {
		sessionId,
		channel,
		payload,
	};
}
