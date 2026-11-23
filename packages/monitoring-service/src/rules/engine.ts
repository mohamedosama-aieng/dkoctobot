import { Alert, AlertRule, MonitoringEvent } from '../domain/contracts'

export interface AlertIdFactory {
    (rule: AlertRule, event: MonitoringEvent): string
}

function valueAt(payload: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((current, key) => {
        if (current && typeof current === 'object') return (current as Record<string, unknown>)[key]
        return undefined
    }, payload)
}

function matches(actual: unknown, rule: AlertRule): boolean {
    switch (rule.operator) {
        case 'eq':
            return actual === rule.value
        case 'neq':
            return actual !== rule.value
        case 'contains':
            return typeof actual === 'string' && actual.includes(String(rule.value))
        case 'gt':
            return typeof actual === 'number' && actual > Number(rule.value)
        case 'gte':
            return typeof actual === 'number' && actual >= Number(rule.value)
        case 'lt':
            return typeof actual === 'number' && actual < Number(rule.value)
        case 'lte':
            return typeof actual === 'number' && actual <= Number(rule.value)
    }
}

export class AlertRuleEngine {
    constructor(private readonly idFactory: AlertIdFactory = (rule, event) => `${rule.id}:${event.eventId}`) {}

    evaluate(event: MonitoringEvent, rules: readonly AlertRule[], extracted: Record<string, unknown> = {}): Alert[] {
        return rules
            .filter((rule) => rule.enabled && (!rule.eventType || rule.eventType === event.eventType))
            .filter((rule) => matches(valueAt({ ...extracted, content: event.content }, rule.field), rule))
            .map((rule) => ({
                id: this.idFactory(rule, event),
                ruleId: rule.id,
                eventId: event.eventId,
                severity: rule.severity,
                title: rule.name,
                reason: `${rule.field} ${rule.operator} ${String(rule.value)}`,
                createdAt: event.createdAt,
                entityId: event.sessionId
            }))
    }
}
