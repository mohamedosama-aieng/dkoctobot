import express, { Request, Response } from 'express'

export interface HealthState {
    startedAt: number
    redis: 'disabled' | 'up' | 'down'
    consumer?: object
}

export function startServer(port: number, health: HealthState): express.Express {
    const app = express()
    app.get('/health', (_request: Request, response: Response) =>
        response.status(health.redis === 'down' ? 503 : 200).json({
            status: health.redis === 'down' ? 'degraded' : 'healthy',
            uptime: Math.floor((Date.now() - health.startedAt) / 1000),
            ...health
        })
    )
    app.listen(port, () => process.stdout.write(`Monitoring service listening on :${port}\n`))
    return app
}
