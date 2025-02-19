class Mutex {
	private locked = false;
	private queue: (() => void)[] = [];

	constructor(locked: boolean) {
		this.locked = locked;
	}

	acquire() {
		return new Promise<void>((resolve) => {
			if (!this.locked) {
				this.locked = true;
				resolve();
			} else {
				this.queue.push(resolve);
			}
		});
	}

	release() {
		if (this.queue.length > 0) {
			const next = this.queue.shift();
			next?.();
		} else {
			this.locked = false;
		}
	}
}

export default function mutex(locked = false) {
	return new Mutex(locked);
}
