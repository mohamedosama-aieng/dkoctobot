#!/usr/bin/env node
/**
 * migrate-models-api.js
 *
 * Simple API server for model migration with web UI
 */

const { Client } = require('pg')
const http = require('http')
const fs = require('fs')
const path = require('path')
const url = require('url')

// ── Config ────────────────────────────────────────────────────────────────────
const DB = {
    host: process.env.DATABASE_HOST || '178.63.34.211',
    port: parseInt(process.env.DATABASE_PORT || '10034'),
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'Eng.OctoBot-DK-Kareem-DODGE.12',
    database: process.env.DATABASE_NAME || 'dk_octobot',
    ssl: false
}

const PORT = process.env.MIGRATE_PORT || 3001

// ── Helpers ───────────────────────────────────────────────────────────────────

function replaceModelInFlowData(flowData, from, to) {
    let updated = false
    const data = JSON.parse(JSON.stringify(flowData))
    const updatedNodes = []

    if (!data.nodes || !Array.isArray(data.nodes)) return { updated, data, updatedNodes }

    for (const node of data.nodes) {
        const inputs = node?.data?.inputs
        if (!inputs) continue

        if (inputs.modelName === from) {
            inputs.modelName = to
            updated = true
            updatedNodes.push({
                id: node.id,
                type: node.data?.name,
                field: 'modelName'
            })
        }

        if (inputs.model === from) {
            inputs.model = to
            updated = true
            updatedNodes.push({
                id: node.id,
                type: node.data?.name,
                field: 'model'
            })
        }
    }

    return { updated, data, updatedNodes }
}

function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    })
    res.end(JSON.stringify(data))
}

function sendHTML(res, filePath) {
    fs.readFile(filePath, 'utf8', (err, content) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain' })
            res.end('Error loading page')
            return
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(content)
    })
}

// ── API Handlers ──────────────────────────────────────────────────────────────

async function getModels(res) {
    // Return only the 3 allowed models
    const allowedModels = ['grok-4.3', 'gemini-2.5-flash', 'gemini-3-pro-preview']

    sendJSON(res, 200, {
        success: true,
        models: allowedModels
    })
}

async function previewMigration(res, body) {
    const { fromModel, toModel } = body

    if (!fromModel || !toModel) {
        sendJSON(res, 400, {
            success: false,
            error: 'fromModel and toModel are required'
        })
        return
    }

    const client = new Client(DB)
    try {
        await client.connect()

        const { rows } = await client.query(`SELECT id, name, "flowData" FROM chat_flow WHERE "flowData" LIKE $1`, [`%${fromModel}%`])

        const results = []

        for (const row of rows) {
            try {
                const flowData = JSON.parse(row.flowData)
                const { updated, updatedNodes } = replaceModelInFlowData(flowData, fromModel, toModel)

                if (updated) {
                    results.push({
                        id: row.id,
                        name: row.name,
                        nodes: updatedNodes
                    })
                }
            } catch (e) {
                // Skip invalid JSON
            }
        }

        await client.end()

        sendJSON(res, 200, {
            success: true,
            totalFound: rows.length,
            willMigrate: results.length,
            skipped: rows.length - results.length,
            chatflows: results
        })
    } catch (error) {
        await client.end()
        sendJSON(res, 500, {
            success: false,
            error: error.message
        })
    }
}

async function executeMigration(res, body) {
    const { fromModel, toModel } = body

    if (!fromModel || !toModel) {
        sendJSON(res, 400, {
            success: false,
            error: 'fromModel and toModel are required'
        })
        return
    }

    const client = new Client(DB)
    try {
        await client.connect()

        const { rows } = await client.query(`SELECT id, name, "flowData" FROM chat_flow WHERE "flowData" LIKE $1`, [`%${fromModel}%`])

        let migratedCount = 0
        let skippedCount = 0
        const results = []

        for (const row of rows) {
            try {
                const flowData = JSON.parse(row.flowData)
                const { updated, data, updatedNodes } = replaceModelInFlowData(flowData, fromModel, toModel)

                if (updated) {
                    await client.query(`UPDATE chat_flow SET "flowData" = $1, "updatedDate" = NOW() WHERE id = $2`, [
                        JSON.stringify(data),
                        row.id
                    ])

                    migratedCount++
                    results.push({
                        id: row.id,
                        name: row.name,
                        status: 'updated',
                        nodes: updatedNodes
                    })
                } else {
                    skippedCount++
                    results.push({
                        id: row.id,
                        name: row.name,
                        status: 'skipped'
                    })
                }
            } catch (e) {
                skippedCount++
                results.push({
                    id: row.id,
                    name: row.name,
                    status: 'error',
                    error: e.message
                })
            }
        }

        await client.end()

        sendJSON(res, 200, {
            success: true,
            totalFound: rows.length,
            migrated: migratedCount,
            skipped: skippedCount,
            chatflows: results
        })
    } catch (error) {
        await client.end()
        sendJSON(res, 500, {
            success: false,
            error: error.message
        })
    }
}

// ── HTTP Server ───────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true)
    const pathname = parsedUrl.pathname

    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        })
        res.end()
        return
    }

    // Home page
    if (pathname === '/' && req.method === 'GET') {
        sendHTML(res, path.join(__dirname, 'migrate-models-ui.html'))
        return
    }

    // API: Get models
    if (pathname === '/api/models' && req.method === 'GET') {
        getModels(res)
        return
    }

    // API: Preview or Execute
    if ((pathname === '/api/preview' || pathname === '/api/migrate') && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk) => {
            body += chunk
        })
        req.on('end', () => {
            try {
                const parsed = JSON.parse(body)
                if (pathname === '/api/preview') {
                    previewMigration(res, parsed)
                } else {
                    executeMigration(res, parsed)
                }
            } catch (e) {
                sendJSON(res, 400, { success: false, error: 'Invalid JSON' })
            }
        })
        return
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
})

server.listen(PORT, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`  🚀 Model Migration API`)
    console.log(`  📡 Server: http://localhost:${PORT}`)
    console.log(`  🗄️  Database: ${DB.host}:${DB.port}/${DB.database}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`\n  افتح المتصفح على: http://localhost:${PORT}\n`)
})
