#!/usr/bin/env node
/**
 * fix-empty-models.js
 *
 * Find all chatflows with empty/missing modelName and set them to google/gemini-2.5-flash
 */

const { Client } = require('pg')

const DB = {
    host: process.env.DATABASE_HOST || '178.63.34.211',
    port: parseInt(process.env.DATABASE_PORT || '10034'),
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'Eng.OctoBot-DK-Kareem-DODGE.12',
    database: process.env.DATABASE_NAME || 'dk_octobot',
    ssl: false
}

const DEFAULT_MODEL = 'google/gemini-2.5-flash'

;(async () => {
    console.log('==============================================')
    console.log('  Fix Empty Models')
    console.log('  Default: ' + DEFAULT_MODEL)
    console.log('==============================================\n')

    const client = new Client(DB)
    await client.connect()

    const { rows } = await client.query(`SELECT id, name, "flowData" FROM chat_flow`)

    let fixedCount = 0
    let skippedCount = 0

    for (const row of rows) {
        try {
            const flowData = JSON.parse(row.flowData)
            let updated = false

            if (flowData.nodes && Array.isArray(flowData.nodes)) {
                for (const node of flowData.nodes) {
                    const inputs = node?.data?.inputs
                    if (!inputs) continue

                    // Check if modelName field exists but is empty/null
                    if ('modelName' in inputs && (!inputs.modelName || inputs.modelName === '')) {
                        console.log('[' + row.id + '] "' + row.name + '"')
                        console.log(
                            '  -> node [' + node.id + '] type="' + node.data?.name + '" -> empty modelName -> "' + DEFAULT_MODEL + '"'
                        )
                        inputs.modelName = DEFAULT_MODEL
                        updated = true
                    }
                }
            }

            if (updated) {
                await client.query(`UPDATE chat_flow SET "flowData" = $1, "updatedDate" = NOW() WHERE id = $2`, [
                    JSON.stringify(flowData),
                    row.id
                ])
                console.log('  Updated!\n')
                fixedCount++
            } else {
                skippedCount++
            }
        } catch (e) {
            console.log('  Error [' + row.id + ']: ' + e.message + '\n')
            skippedCount++
        }
    }

    await client.end()

    console.log('==============================================')
    console.log('  Total checked : ' + rows.length)
    console.log('  Fixed         : ' + fixedCount)
    console.log('  Skipped       : ' + skippedCount)
    console.log('==============================================')
})().catch((err) => {
    console.error('\n❌ Fatal error:', err.message)
    process.exit(1)
})
