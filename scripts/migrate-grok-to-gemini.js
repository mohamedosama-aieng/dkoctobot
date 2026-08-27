#!/usr/bin/env node
/**
 * migrate-grok-to-gemini.js
 *
 * Converts all chatflows using a specified Grok model to gemini-2.5-flash.
 * Updates the flowData JSON in the chat_flow table.
 *
 * Usage:
 *   node scripts/migrate-grok-to-gemini.js [--from grok-4.3] [--to gemini-2.5-flash] [--dry-run]
 */

const { Client } = require('pg')

// ── Config ────────────────────────────────────────────────────────────────────
const DB = {
    host: process.env.DATABASE_HOST || '178.63.34.211',
    port: parseInt(process.env.DATABASE_PORT || '10034'),
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'Eng.OctoBot-DK-Kareem-DODGE.12',
    database: process.env.DATABASE_NAME || 'dk_octobot',
    ssl: false
}

const args = process.argv.slice(2)
const fromModel = getArg(args, '--from') || 'grok-4.3'
const toModel = getArg(args, '--to') || 'gemini-2.5-flash'
const dryRun = args.includes('--dry-run')

function getArg(arr, flag) {
    const i = arr.indexOf(flag)
    return i !== -1 ? arr[i + 1] : null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Recursively walk the flowData nodes and replace the model name
 * in any node whose inputs.modelName === fromModel.
 * Returns { updated: boolean, data: object }.
 */
function replaceModelInFlowData(flowData, from, to) {
    let updated = false
    const data = JSON.parse(JSON.stringify(flowData)) // deep clone

    if (!data.nodes || !Array.isArray(data.nodes)) return { updated, data }

    for (const node of data.nodes) {
        const inputs = node?.data?.inputs
        if (!inputs) continue

        // modelName field (ChatOpenAI, ChatGroq, ChatGoogleGenerativeAI, etc.)
        if (inputs.modelName === from) {
            console.log(`  ↳ node [${node.id}] type="${node.data?.name}" → modelName: "${from}" → "${to}"`)
            inputs.modelName = to
            updated = true
        }

        // Some nodes store it under a nested credential / model object
        if (inputs.model === from) {
            console.log(`  ↳ node [${node.id}] type="${node.data?.name}" → model: "${from}" → "${to}"`)
            inputs.model = to
            updated = true
        }
    }

    return { updated, data }
}

// ── Main ──────────────────────────────────────────────────────────────────────
;(async () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`  Migrate: "${fromModel}"  →  "${toModel}"`)
    console.log(`  Mode   : ${dryRun ? '🔍 DRY RUN (no writes)' : '✏️  LIVE'}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const client = new Client(DB)
    await client.connect()
    console.log(`\n✅ Connected to ${DB.host}:${DB.port}/${DB.database}\n`)

    // Fetch all chatflows whose flowData contains the target model string
    const { rows } = await client.query(`SELECT id, name, "flowData" FROM chat_flow WHERE "flowData" LIKE $1`, [`%${fromModel}%`])

    if (rows.length === 0) {
        console.log(`ℹ️  No chatflows found containing model "${fromModel}". Nothing to do.`)
        await client.end()
        return
    }

    console.log(`🔎 Found ${rows.length} chatflow(s) containing "${fromModel}":\n`)

    let migratedCount = 0
    let skippedCount = 0

    for (const row of rows) {
        console.log(`📄 [${row.id}] "${row.name}"`)

        let flowData
        try {
            flowData = JSON.parse(row.flowData)
        } catch (e) {
            console.log(`  ⚠️  Failed to parse flowData — skipping. (${e.message})`)
            skippedCount++
            continue
        }

        const { updated, data } = replaceModelInFlowData(flowData, fromModel, toModel)

        if (!updated) {
            console.log(`  ℹ️  Model string found in raw JSON but not in node inputs — skipping.\n`)
            skippedCount++
            continue
        }

        if (!dryRun) {
            await client.query(`UPDATE chat_flow SET "flowData" = $1, "updatedDate" = NOW() WHERE id = $2`, [JSON.stringify(data), row.id])
            console.log(`  ✅ Updated!\n`)
        } else {
            console.log(`  🔍 Would update (dry-run).\n`)
        }

        migratedCount++
    }

    await client.end()

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`  Total found  : ${rows.length}`)
    console.log(`  Migrated     : ${migratedCount}`)
    console.log(`  Skipped      : ${skippedCount}`)
    if (dryRun) console.log('\n  ⚠️  DRY RUN — run without --dry-run to apply changes.')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
})().catch((err) => {
    console.error('\n❌ Fatal error:', err.message)
    process.exit(1)
})
