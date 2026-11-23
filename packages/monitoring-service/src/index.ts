import { Redis } from 'ioredis'
import { env } from './config/env'
import { AlertRuleEngine } from './rules/engine'
import { MonitoringEvent } from './domain/contracts'
import { StreamConsumer } from './ingest/consumer'
import { startServer, HealthState } from './api/server'

const health: HealthState = { startedAt: Date.now(), redis: env.redisUrl || process.env.MONITORING_REDIS_HOST ? 'down' : 'disabled' }
let redis: Redis | undefined
let consumer: StreamConsumer | undefined

async function main(): Promise<void> {
    const engine = new AlertRuleEngine()
    if (health.redis !== 'disabled') {
        redis = env.redisUrl ? new Redis(env.redisUrl) : new Redis({ host: env.redisHost, port: env.redisPort })
        await redis.ping()
        health.redis = 'up'
        consumer = new StreamConsumer(redis, async (event: MonitoringEvent) => {
            engine.evaluate(event, [])
        })
        await consumer.start()
        health.consumer = consumer.stats
    }
    startServer(env.port, health)
}

void main().catch((error) => {
    health.redis = 'down'
    process.stderr.write(`${String(error)}\n`)
    startServer(env.port, health)
})
process.on('SIGTERM', () => {
    consumer?.stop()
    void redis?.quit()
    process.exit(0)
})
process.on('SIGINT', () => {
    consumer?.stop()
    void redis?.quit()
    process.exit(0)
})
