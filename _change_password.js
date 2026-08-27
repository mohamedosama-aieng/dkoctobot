/**
 * Script to change the password for a user in the DK-Platform database.
 *
 * Usage: node _change_password.js
 */

const bcrypt = require('bcryptjs')
const { Client } = require('pg')

const EMAIL = 'octobotchatbot@gmail.com'
const NEW_PASSWORD = 'Eng.Kareem$DODGE@2'
const SALT_ROUNDS = 10

const dbConfig = {
    host: '178.63.34.211',
    port: 10034,
    database: 'dk_octobot',
    user: 'postgres',
    password: 'Eng.OctoBot-DK-Kareem-DODGE.12',
    ssl: false
}

async function changePassword() {
    const client = new Client(dbConfig)

    try {
        await client.connect()
        console.log('Connected to database.')

        // Check if user exists
        const userResult = await client.query('SELECT id, email, name FROM "user" WHERE email = $1', [EMAIL])

        if (userResult.rows.length === 0) {
            console.error(`User with email "${EMAIL}" not found!`)
            process.exit(1)
        }

        const user = userResult.rows[0]
        console.log(`Found user: ${user.name} (${user.email}) [ID: ${user.id}]`)

        // Hash the new password
        const salt = bcrypt.genSaltSync(SALT_ROUNDS)
        const hashedPassword = bcrypt.hashSync(NEW_PASSWORD, salt)
        console.log('New password hashed successfully.')

        // Update the password in the database
        await client.query('UPDATE "user" SET credential = $1 WHERE email = $2', [hashedPassword, EMAIL])

        console.log(`Password updated successfully for: ${EMAIL}`)

        // Invalidate all active sessions for this user
        console.log('Invalidating all active sessions...')
        const sessionDeleteResult = await client.query(`DELETE FROM login_sessions WHERE sess->'passport'->'user'->>'id' = $1`, [user.id])
        console.log(`Deleted ${sessionDeleteResult.rowCount} active session(s)`)

        console.log(`\n✓ Password changed to: ${NEW_PASSWORD}`)
        console.log(`✓ All sessions terminated - user must login again`)
    } catch (error) {
        console.error('Error:', error.message)
        console.error('Full error:', error)
        process.exit(1)
    } finally {
        await client.end()
        console.log('\nDatabase connection closed.')
    }
}

changePassword()
