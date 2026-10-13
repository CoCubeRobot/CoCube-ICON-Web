// write() returns accepted bytes immediately, while drain() awaits native I/O.
export class SerialWriteQueue {
    constructor(send, onError, capacity = 4096) {
        this.send = send;
        this.onError = onError;
        this.capacity = capacity;
        this.pendingBytes = 0;
        this.tail = Promise.resolve();
        this.closed = false;
        this.error = null;
    }

    write(data) {
        if (this.closed || this.error || !data?.byteLength) return 0;
        const count = Math.min(data.byteLength, this.capacity - this.pendingBytes);
        if (!count) return 0;
        const bytes = data.slice(0, count);
        this.pendingBytes += count;
        this.tail = this.tail.then(async () => {
            try {
                if (!this.error) await this.send(bytes);
            } catch (error) {
                this.error = error;
                this.closed = true;
                this.onError(error);
            } finally {
                this.pendingBytes -= count;
            }
        });
        return count;
    }

    async drain() {
        await this.tail;
        if (this.error) throw this.error;
    }

    async close() {
        this.closed = true;
        await this.drain();
    }
}
