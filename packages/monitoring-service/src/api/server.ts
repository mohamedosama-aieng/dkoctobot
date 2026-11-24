import { createServer, Server } from 'node:http'

export interface HealthState {
    startedAt: number
    redis: 'disabled' | 'up' | 'down'
    consumer?: object
}

export function startServer(port: number, health: HealthState): Server {
    const server = createServer((request, response) => {
        if (request.method !== 'GET' || request.url !== '/health') {
            response.writeHead(404, { 'content-type': 'application/json' })
            response.end(JSON.stringify({ error: 'Not found' }))
            return
        }

        const unavailable = health.redis === 'down'
        response.writeHead(unavailable ? 503 : 200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({
            status: unavailable ? 'degraded' : 'healthy',
            uptime: Math.floor((Date.now() - health.startedAt) / 1000),
            ...health
        }))
    })

    server.listen(port, '0.0.0.0', () => process.stdout.write(`Monitoring service listening on :${port}\n`))
    return server
}
