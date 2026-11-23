export type MonitoringFieldType = 'text' | 'number' | 'boolean' | 'select'
export type MonitoringOperator =
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'starts_with'
    | 'is_not_empty'
    | 'greater_than'
    | 'less_than'
    | 'is_true'
    | 'is_false'
    | 'is_one_of'

export interface MonitoringField {
    key: string
    displayName: string
    type: MonitoringFieldType
    required: boolean
    enabled: boolean
    position: number
    options?: string[]
}

export interface MonitoringCondition {
    field: string
    operator: MonitoringOperator
    value?: unknown
}

export interface MonitoringAlertRule {
    id: string
    name: string
    conditions: MonitoringCondition[]
    logic: 'all' | 'any'
    level: 'none' | 'warning' | 'danger'
    reason: string
    enabled: boolean
}

export interface MonitoringPolicyData {
    chatflowId: string
    enabled: boolean
    frequency: 'every_user_message' | 'important_messages' | 'session_end'
    analysisMode: string
    language: string
    model: string
    contextMessages: number
    extractOnlyNewFacts: boolean
    confidenceThreshold: number
    crmConnectionId?: string
    fields: MonitoringField[]
    alertRules: MonitoringAlertRule[]
    instructions: Record<string, unknown>
    version: number
    status: 'draft' | 'published'
}

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

export function validateMonitoringPolicy(input: Partial<MonitoringPolicyData>): string[] {
    const errors: string[] = []
    const fields = input.fields || []
    const keys = new Set<string>()
    for (const field of fields) {
        if (!/^[a-z][a-z0-9_]*$/.test(field.key)) errors.push(`Invalid field key: ${field.key}`)
        if (keys.has(field.key)) errors.push(`Duplicate field key: ${field.key}`)
        keys.add(field.key)
        if (!field.displayName?.trim()) errors.push(`Display name is required for ${field.key}`)
        if (field.type !== 'select' && field.options?.length) errors.push(`Options are only valid for select field ${field.key}`)
        if (field.type === 'select' && (!field.options || field.options.length === 0))
            errors.push(`Select field ${field.key} needs an option`)
    }
    if (input.confidenceThreshold !== undefined && (input.confidenceThreshold < 0 || input.confidenceThreshold > 1))
        errors.push('Confidence threshold must be between 0 and 1')
    for (const rule of input.alertRules || []) {
        if (!rule.name?.trim()) errors.push('Alert name is required')
        if (!rule.conditions?.length) errors.push(`Alert ${rule.name || rule.id} needs a condition`)
        if (!['none', 'warning', 'danger'].includes(rule.level)) errors.push(`Invalid alert level for ${rule.name || rule.id}`)
    }
    return errors
}
