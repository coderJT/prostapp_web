const queues = new Map();

function normalizeQueueKey(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return normalized || 'anonymous';
}

function getQueueDepth(key) {
    return queues.get(key)?.depth || 0;
}

function enqueuePrediction(userKey, task) {
    const key = normalizeQueueKey(userKey);
    const currentQueue = queues.get(key) || { tail: Promise.resolve(), depth: 0 };
    const position = currentQueue.depth + 1;
    currentQueue.depth = position;

    const run = currentQueue.tail
        .catch(() => {
            // Keep the queue moving even when the previous task failed.
        })
        .then(task);

    currentQueue.tail = run.finally(() => {
        const latestQueue = queues.get(key);
        if (!latestQueue) return;
        latestQueue.depth = Math.max(0, latestQueue.depth - 1);
        if (latestQueue.depth === 0 && latestQueue.tail === currentQueue.tail) {
            queues.delete(key);
        }
    });

    queues.set(key, currentQueue);

    return {
        key,
        position,
        run,
    };
}

module.exports = {
    enqueuePrediction,
    getQueueDepth,
    normalizeQueueKey,
};
