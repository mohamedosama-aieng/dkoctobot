import { Redis } from 'ioredis'
import { env } from './config/env'
import { AlertRuleEngine } from './rules/engine'
import { MonitoringEvent, MonitoringPolicy } from './domain/contracts'
import { StreamConsumer } from './ingest/consumer'
import { startServer, HealthState } from './api/server'
import { MonitoringProcessor, MonitoringPolicyResolver } from './worker/processor'
import { StructuredLlmExtractor } from './adapters/llm'
import { HttpCrmMonitoringClient } from './adapters/crm'

const health: HealthState = { startedAt: Date.now(), redis: env.redisUrl || process.env.MONITORING_REDIS_HOST ? 'down' : 'disabled' }
let redis: Redis | undefined
let consumer: StreamConsumer | undefined

async function main(): Promise<void> {
    const crm = new HttpCrmMonitoringClient(env.crmBaseUrl, '')
    const policies: MonitoringPolicyResolver = {
        async getPolicy(chatflowId: string, _version: number): Promise<MonitoringPolicy | null> {
            const response = await fetch(`${env.crmBaseUrl.replace(/\/$/, '')}/api/integration/monitoring-config/by-chatflow/${encodeURIComponent(chatflowId)}`, {
                headers: { 'x-monitoring-worker-token': env.workerToken }
            })
            if (response.status === 404) return null
            if (!response.ok) throw new Error(`CRM policy request failed (${response.status})`)
            const body = (await response.json()) as { data: Omit<MonitoringPolicy, 'apiKey' | 'rules'> & { api_key: string; alert_rules: MonitoringPolicy['rules'] } }
            const data = body.data
            return { ...data, apiKey: data.api_key, rules: data.alert_rules || [], fields: data.fields || [] } as MonitoringPolicy
        }
    }
    const extractor = new StructuredLlmExtractor({
        async complete(request) {
            if (!env.openRouterApiKey) throw new Error('OPENROUTER_API_KEY is not configured')
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: { authorization: `Bearer ${env.openRouterApiKey}`, 'content-type': 'application/json' },
                body: JSON.stringify({ model: env.openRouterModel, messages: [{ role: 'system', content: request.system }, { role: 'user', content: request.user }], response_format: { type: 'json_object' }, temperature: 0.1 })
            })
            if (!response.ok) throw new Error(`LLM request failed (${response.status})`)
            const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
            return JSON.parse(data.choices?.[0]?.message?.content || '{}')
        }
    })
    const processor = new MonitoringProcessor(policies, extractor, crm)
    if (health.redis !== 'disabled') {
        redis = env.redisUrl ? new Redis(env.redisUrl) : new Redis({ host: env.redisHost, port: env.redisPort })
        await redis.ping()
        health.redis = 'up'
        consumer = new StreamConsumer(redis, async (event: MonitoringEvent) => processor.process(event))
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
