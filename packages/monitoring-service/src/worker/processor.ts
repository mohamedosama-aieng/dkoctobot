import { CrmMonitoringClient, LlmExtractor, MonitoringEvent, MonitoringPolicy } from '../domain/contracts'
import { AlertRuleEngine } from '../rules/engine'

export interface MonitoringPolicyResolver {
    getPolicy(chatflowId: string, version: number): Promise<MonitoringPolicy | null>
}

export class MonitoringProcessor {
    constructor(
        private readonly policies: MonitoringPolicyResolver,
        private readonly extractor: LlmExtractor,
        private readonly crm: CrmMonitoringClient,
        private readonly analysisVersion = 'monitoring-worker-1'
    ) {}

    async process(event: MonitoringEvent): Promise<void> {
        const policy = await this.policies.getPolicy(event.chatflowId, event.policyVersion)
        if (!policy || !event.sessionId) return
        const extraction = await this.extractor.extract({ text: event.content, event, policy })
        const allowedFields = new Set(policy.fields.map((field) => field.key))
        const facts = Object.fromEntries(extraction.entities.filter((entity) => allowedFields.has(entity.type)).map((entity) => [entity.type, entity.value]))
        const alerts = new AlertRuleEngine().evaluate(event, policy.rules, facts)
        const alert = alerts.sort((a, b) => (b.severity === 'critical' ? 2 : b.severity === 'warning' ? 1 : 0) - (a.severity === 'critical' ? 2 : a.severity === 'warning' ? 1 : 0))[0]
        const confidence = Math.max(0, Math.min(1, extraction.confidence))
        if (confidence < policy.confidenceThreshold) {
            extraction.summary = `${extraction.summary}\nAnalysis confidence below configured threshold (${confidence.toFixed(2)}).`
            return this.crm.sendNote({
                eventId: event.eventId,
                messageId: event.messageId,
                policyVersion: event.policyVersion,
                analysisVersion: this.analysisVersion,
                sessionId: event.sessionId,
                chatflowId: event.chatflowId,
                note: extraction.summary,
                keys: {},
                sentiment: extraction.sentiment || 'neutral',
                alertLevel: 'none',
                alertReason: ''
            }, policy.apiKey).then(() => undefined)
        }
        await this.crm.sendNote({
            eventId: event.eventId,
            messageId: event.messageId,
            policyVersion: event.policyVersion,
            analysisVersion: this.analysisVersion,
            sessionId: event.sessionId,
            chatflowId: event.chatflowId,
            note: extraction.summary,
            keys: facts,
            sentiment: extraction.sentiment || 'neutral',
            alertLevel: alert?.severity === 'critical' ? 'danger' : alert?.severity === 'warning' ? 'warning' : 'none',
            alertReason: alert?.reason || ''
        }, policy.apiKey)
    }
}
