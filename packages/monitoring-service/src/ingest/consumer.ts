import { Redis } from 'ioredis'
import { MonitoringEvent } from '../domain/contracts'
import { env } from '../config/env'

export type EventHandler = (event: MonitoringEvent) => Promise<void>
export interface ConsumerStats {
    processed: number
    retried: number
    deadLettered: number
    lastEventAt: number
}

export class StreamConsumer {
    readonly stats: ConsumerStats = { processed: 0, retried: 0, deadLettered: 0, lastEventAt: 0 }
    private running = false

    constructor(private readonly redis: Redis, private readonly handle: EventHandler, private readonly options = env) {}

    async start(): Promise<void> {
        await this.ensureGroup()
        this.running = true
        void this.loop()
    }

    stop(): void {
        this.running = false
    }

    private async ensureGroup(): Promise<void> {
        for (const stream of [this.options.eventsStream, this.options.retryStream]) {
            try {
                await this.redis.xgroup('CREATE', stream, this.options.consumerGroup, '$', 'MKSTREAM')
            } catch (error) {
                if (!String(error).includes('BUSYGROUP')) throw error
            }
        }
    }

    private async loop(): Promise<void> {
        while (this.running) {
            try {
                const result = (await this.redis.xreadgroup(
                    'GROUP',
                    this.options.consumerGroup,
                    this.options.consumerName,
                    'COUNT',
                    25,
                    'BLOCK',
                    this.options.blockMs,
                    'STREAMS',
                    this.options.eventsStream,
                    this.options.retryStream,
                    '>',
                    '>'
                )) as Array<[string, Array<[string, string[]]>]> | null
                for (const [stream, entries] of result || []) for (const [id, fields] of entries) await this.process(stream, id, fields)
            } catch {
                await new Promise((resolve) => setTimeout(resolve, 250))
            }
        }
    }

    private async process(stream: string, id: string, fields: string[]): Promise<void> {
        const data = this.toObject(fields)
        const attempts = Number(data.attempts || 0)
        try {
            await this.handle(JSON.parse(data.event) as MonitoringEvent)
            await this.redis.xack(stream, this.options.consumerGroup, id)
            this.stats.processed++
            this.stats.lastEventAt = Date.now()
        } catch (error) {
            const destination = attempts + 1 > this.options.maxRetries ? this.options.deadLetterStream : this.options.retryStream
            await this.redis.xadd(destination, '*', 'event', data.event, 'attempts', String(attempts + 1), 'error', String(error))
            await this.redis.xack(stream, this.options.consumerGroup, id)
            if (destination === this.options.deadLetterStream) this.stats.deadLettered++
            else this.stats.retried++
        }
    }

    private toObject(fields: string[]): Record<string, string> {
        const result: Record<string, string> = {}
        for (let i = 0; i < fields.length; i += 2) result[fields[i]] = fields[i + 1]
        return result
    }
}
