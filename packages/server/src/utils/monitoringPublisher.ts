import Redis from 'ioredis'
import { v4 as uuidv4 } from 'uuid'
import logger from './logger'
import { MonitoringEvent } from './monitoringContracts'

const STREAM = process.env.MONITORING_EVENTS_STREAM || 'flowise:events:monitoring'
const MAXLEN = parseInt(process.env.MONITORING_EVENTS_MAXLEN || '1000000', 10)
let client: Redis | null = null

function getClient(): Redis | null {
    if (process.env.MONITORING_ENABLED === 'false') return null
    if (client) return client
    try {
        client = new Redis(process.env.MONITORING_REDIS_URL || process.env.REDIS_URL || 'redis://localhost:6379', {
            maxRetriesPerRequest: null
        })
        client.on('error', (error) => logger.debug(`[MonitoringPublisher] Redis error: ${error.message}`))
        return client
    } catch (error) {
        logger.warn(`[MonitoringPublisher] Redis unavailable: ${error}`)
        return null
    }
}

export async function publishMonitoringEvent(input: Omit<MonitoringEvent, 'eventId' | 'eventType'>): Promise<void> {
    const redis = getClient()
    if (!redis) return
    const event: MonitoringEvent = { ...input, eventId: uuidv4(), eventType: 'user_message' }
    try {
        await redis.xadd(STREAM, 'MAXLEN', '~', MAXLEN.toString(), '*', 'event', JSON.stringify(event))
    } catch (error) {
        logger.debug(`[MonitoringPublisher] publish failed: ${error}`)
    }
}
