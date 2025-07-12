import fs from 'node:fs';
import fsPromises from 'node:fs/promises';

// Simple overlayfs implementation for tests
class OverlayFS {
	constructor() {
		this.overlays = new Map();
	}

	// Create a virtual file at the given path
	createFile(filePath, content) {
		this.overlays.set(filePath, content);
	}

	// Check if a file exists in our overlay
	exists(filePath) {
		return this.overlays.has(filePath);
	}

	// Read a file from our overlay
	readFile(filePath) {
		if (this.overlays.has(filePath)) {
			return this.overlays.get(filePath);
		}
		throw new Error(`File not found: ${filePath}`);
	}

	// Clean up all overlays
	clear() {
		this.overlays.clear();
	}
}

// Global overlayfs instance
export const overlayFS = new OverlayFS();

// Monkey patch fs.readFileSync to use our overlay
const originalReadFileSync = fs.readFileSync;
fs.readFileSync = function (filePath, options) {
	if (overlayFS.exists(filePath)) {
		const content = overlayFS.readFile(filePath);
		if (options?.encoding) {
			return content;
		}
		return Buffer.from(content);
	}
	return originalReadFileSync.call(this, filePath, options);
};

// Monkey patch fs.promises.readFile (async) to use our overlay
const originalAsyncReadFile = fsPromises.readFile;
fsPromises.readFile = function (filePath, options) {
	if (overlayFS.exists(filePath)) {
		const content = overlayFS.readFile(filePath);
		if (options?.encoding) {
			return Promise.resolve(content);
		}
		return Promise.resolve(Buffer.from(content));
	}
	return originalAsyncReadFile.call(this, filePath, options);
};

// Monkey patch fs.access to handle overlayfs directories
const originalAccess = fs.access;
fs.access = function (filePath, mode, callback) {
	// Handle directories that should exist in our overlay
	if (filePath === '/var/lib/headplane/' || filePath === '/var/lib/headplane') {
		if (callback) {
			callback(null);
		} else {
			return Promise.resolve();
		}
		return;
	}
	return originalAccess.call(this, filePath, mode, callback);
};

// Monkey patch fs.promises.access to handle overlayfs directories
const originalAsyncAccess = fsPromises.access;
fsPromises.access = function (filePath, mode) {
	// Handle directories that should exist in our overlay
	if (filePath === '/var/lib/headplane/' || filePath === '/var/lib/headplane') {
		return Promise.resolve();
	}
	return originalAsyncAccess.call(this, filePath, mode);
};
