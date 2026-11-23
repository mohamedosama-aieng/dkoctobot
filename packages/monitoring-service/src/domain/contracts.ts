export type AlertSeverity = 'info' | 'warning' | 'critical'
export type AlertOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains'

export interface MonitoringEvent {
    eventId: string
    eventType: 'user_message'
    chatflowId: string
    chatId: string
    sessionId?: string
    messageId: string
    role: 'userMessage'
    content: string
    createdAt: string
    policyVersion: number
}

export interface AlertRule {
    id: string
    name: string
    enabled: boolean
    eventType?: string
    field: string
    operator: AlertOperator
    value: string | number | boolean
    severity: AlertSeverity
    cooldownSeconds?: number
}

export interface Alert {
    id: string
    ruleId: string
    eventId: string
    severity: AlertSeverity
    title: string
    reason: string
    createdAt: string
    entityId?: string
    extracted?: Record<string, unknown>
}

export interface CrmMonitoringNote {
    eventId: string
    messageId: string
    policyVersion: number
    analysisVersion: string
    sessionId: string
    note: string
    keys: Record<string, unknown>
    sentiment: 'positive' | 'neutral' | 'negative'
    alertLevel: 'none' | 'warning' | 'danger'
    alertReason: string
}

export interface StructuredExtraction {
    summary: string
    sentiment?: 'positive' | 'neutral' | 'negative'
    entities: Array<{ type: string; value: string }>
    confidence: number
}

export interface LlmExtractor {
    extract(input: { text: string; event: MonitoringEvent }): Promise<StructuredExtraction>
}

export interface CrmAlertClient {
    createAlert(alert: Alert, idempotencyKey: string): Promise<{ externalId: string }>
}

export interface CrmMonitoringClient {
    sendNote(note: CrmMonitoringNote): Promise<{ duplicate?: boolean; id?: string }>
}
