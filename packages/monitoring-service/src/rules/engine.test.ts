import assert from 'node:assert/strict'
import test from 'node:test'
import { AlertRuleEngine } from './engine'
import { MonitoringEvent } from '../domain/contracts'

const event: MonitoringEvent = {
    eventId: 'evt-1',
    eventType: 'user_message',
    chatflowId: 'flow-1',
    chatId: 'chat-1',
    messageId: 'msg-1',
    role: 'userMessage',
    content: 'hello',
    createdAt: '2026-01-01T00:00:00.000Z',
    policyVersion: 1
}

test('evaluates nested fields deterministically and ignores disabled rules', () => {
    const alerts = new AlertRuleEngine().evaluate(
        event,
        [
            {
                id: 'r1',
                name: 'Too many attempts',
                enabled: true,
                eventType: 'user_message',
                field: 'attempts',
                operator: 'gte',
                value: 3,
                severity: 'warning'
            },
            { id: 'r2', name: 'Disabled', enabled: false, field: 'attempts', operator: 'gt', value: 0, severity: 'critical' },
            {
                id: 'r3',
                name: 'Wrong event',
                enabled: true,
                eventType: 'other',
                field: 'attempts',
                operator: 'gt',
                value: 0,
                severity: 'info'
            }
        ],
        { attempts: 4, customer: { tier: 'gold' } }
    )
    assert.deepEqual(
        alerts.map((alert) => alert.id),
        ['r1:evt-1']
    )
    assert.equal(alerts[0].reason, 'attempts gte 3')
})
