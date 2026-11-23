import { AlertRule, CrmMonitoringClient, LlmExtractor, MonitoringEvent } from '../domain/contracts'
import { AlertRuleEngine } from '../rules/engine'

export interface MonitoringPolicyResolver {
    getPolicy(chatflowId: string, version: number): Promise<{ fields: string[]; rules: AlertRule[] } | null>
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
        const extraction = await this.extractor.extract({ text: event.content, event })
        const facts = Object.fromEntries(extraction.entities.map((entity) => [entity.type, entity.value]))
        const alerts = new AlertRuleEngine().evaluate(event, policy.rules, facts)
        const alert = alerts[0]
        await this.crm.sendNote({
            eventId: event.eventId,
            messageId: event.messageId,
            policyVersion: event.policyVersion,
            analysisVersion: this.analysisVersion,
            sessionId: event.sessionId,
            note: extraction.summary,
            keys: facts,
            sentiment: extraction.sentiment || 'neutral',
            alertLevel: alert?.severity === 'critical' ? 'danger' : alert?.severity === 'warning' ? 'warning' : 'none',
            alertReason: alert?.reason || ''
        })
    }
}
