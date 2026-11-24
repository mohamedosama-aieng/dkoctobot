import assert from 'node:assert/strict'
import { once } from 'node:events'
import { request } from 'node:http'
import test from 'node:test'
import { startServer } from './server'

test('health endpoint reports service status without Express routing', async () => {
    const health = { startedAt: Date.now(), redis: 'up' as const }
    const server = startServer(0, health)
    await once(server, 'listening')

    try {
        const address = server.address()
        assert.ok(address && typeof address !== 'string')
        const response = await new Promise<{ statusCode?: number; body: string }>((resolve, reject) => {
            const req = request({ host: '127.0.0.1', port: address.port, path: '/health', method: 'GET' }, (res) => {
                let body = ''
                res.setEncoding('utf8')
                res.on('data', (chunk: string) => { body += chunk })
                res.on('end', () => resolve({ statusCode: res.statusCode, body }))
            })
            req.on('error', reject)
            req.end()
        })
        assert.equal(response.statusCode, 200)
        assert.equal(JSON.parse(response.body).status, 'healthy')
    } finally {
        server.close()
        await once(server, 'close')
    }
})

test('health endpoint reports unavailable Redis as degraded', async () => {
    const server = startServer(0, { startedAt: Date.now(), redis: 'down' })
    await once(server, 'listening')

    try {
        const address = server.address()
        assert.ok(address && typeof address !== 'string')
        const statusCode = await new Promise<number | undefined>((resolve, reject) => {
            const req = request({ host: '127.0.0.1', port: address.port, path: '/health', method: 'GET' }, (res) => {
                res.resume()
                res.on('end', () => resolve(res.statusCode))
            })
            req.on('error', reject)
            req.end()
        })
        assert.equal(statusCode, 503)
    } finally {
        server.close()
        await once(server, 'close')
    }
})
