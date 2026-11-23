function number(name: string, fallback: number): number {
    const value = Number(process.env[name])
    return Number.isFinite(value) ? value : fallback
}

export const env = {
    port: number('MONITORING_SERVICE_PORT', 3110),
    redisUrl: process.env.MONITORING_REDIS_URL,
    redisHost: process.env.MONITORING_REDIS_HOST || 'localhost',
    redisPort: number('MONITORING_REDIS_PORT', 6380),
    eventsStream: process.env.MONITORING_EVENTS_STREAM || 'flowise:events:monitoring',
    retryStream: process.env.MONITORING_RETRY_STREAM || 'flowise:events:monitoring:retry',
    deadLetterStream: process.env.MONITORING_DLQ_STREAM || 'flowise:events:monitoring:dead-letter',
    consumerGroup: process.env.MONITORING_CONSUMER_GROUP || 'monitoring-workers',
    consumerName: process.env.MONITORING_CONSUMER_NAME || `monitor-${process.pid}`,
    maxRetries: number('MONITORING_MAX_RETRIES', 3),
    blockMs: number('MONITORING_STREAM_BLOCK_MS', 2000)
}
