#!/usr/bin/env node
/**
 * Update Octobot Chat Model nodes across all stored chatflows.
 * Runs as a dry run by default; pass --apply to persist the changes.
 */

const { Client } = require('pg')

function getArg(name, fallback) {
    const index = process.argv.indexOf(name)
    return index === -1 ? fallback : process.argv[index + 1]
}

const FROM_MODEL = getArg('--from', 'gemini-2.5-flash')
const TO_MODEL = getArg('--to', 'gemini-3-flash')
const APPLY = process.argv.includes('--apply')

function replaceModelInFlow(flowData) {
    if (!Array.isArray(flowData?.nodes)) return []

    const updatedNodes = []
    for (const node of flowData.nodes) {
        const inputs = node?.data?.inputs
        if (node?.data?.name !== 'octobotChatModel' || inputs?.modelName !== FROM_MODEL) continue

        inputs.modelName = TO_MODEL
        updatedNodes.push(node.id)
    }
    return updatedNodes
}

async function main() {
    const requiredEnv = ['DATABASE_HOST', 'DATABASE_USER', 'DATABASE_PASSWORD', 'DATABASE_NAME']
    const missingEnv = requiredEnv.filter((name) => !process.env[name])
    if (missingEnv.length) {
        throw new Error(`Set database connection variables: ${missingEnv.join(', ')}`)
    }

    const client = new Client({
        host: process.env.DATABASE_HOST,
        port: Number.parseInt(process.env.DATABASE_PORT || '5432', 10),
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_NAME,
        ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: process.env.DATABASE_REJECT_UNAUTHORIZED !== 'false' } : false
    })

    await client.connect()
    let transactionStarted = false
    try {
        const { rows } = await client.query('SELECT id, name, "flowData" FROM chat_flow')
        const changes = []
        let invalidFlows = 0

        for (const row of rows) {
            try {
                const originalFlowData = row.flowData
                const flowData = JSON.parse(originalFlowData)
                const nodeIds = replaceModelInFlow(flowData)
                if (nodeIds.length) changes.push({ ...row, flowData, originalFlowData, nodeIds })
            } catch (error) {
                invalidFlows++
                console.warn(`Skipping chatflow ${row.id}: invalid flowData JSON (${error.message})`)
            }
        }

        console.log(`${APPLY ? 'Apply' : 'Dry run'}: ${FROM_MODEL} -> ${TO_MODEL}`)
        console.log(`Scanned ${rows.length} chatflow(s); found ${changes.length} with matching Octobot node(s).`)
        for (const change of changes) {
            console.log(`- ${change.name} (${change.id}): node(s) ${change.nodeIds.join(', ')}`)
        }
        if (invalidFlows) console.log(`Skipped ${invalidFlows} chatflow(s) with invalid JSON.`)

        if (!APPLY || changes.length === 0) {
            if (!APPLY) console.log('No database changes made. Pass --apply to persist these updates.')
            return
        }

        await client.query('BEGIN')
        transactionStarted = true
        for (const change of changes) {
            const result = await client.query(
                'UPDATE chat_flow SET "flowData" = $1, "updatedDate" = NOW() WHERE id = $2 AND "flowData" = $3',
                [JSON.stringify(change.flowData), change.id, change.originalFlowData]
            )
            if (result.rowCount !== 1) {
                throw new Error(`Chatflow ${change.id} changed during migration; transaction aborted.`)
            }
        }
        await client.query('COMMIT')
        transactionStarted = false
        console.log(`Updated ${changes.length} chatflow(s).`)
    } catch (error) {
        if (transactionStarted) await client.query('ROLLBACK')
        throw error
    } finally {
        await client.end()
    }
}

module.exports = { replaceModelInFlow, main }

if (require.main === module) {
    main().catch((error) => {
        console.error(`Migration failed: ${error.message}`)
        process.exitCode = 1
    })
}
