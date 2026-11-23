import { getRunningExpressApp } from '../../utils/getRunningExpressApp'
import { ChatFlow } from '../../database/entities/ChatFlow'
import { MonitoringPolicy } from '../../database/entities/MonitoringPolicy'
import { MonitoringPolicyVersion } from '../../database/entities/MonitoringPolicyVersion'
import { MonitoringPolicyData, validateMonitoringPolicy } from '../../utils/monitoringContracts'
import { InternalFlowiseError } from '../../errors/internalFlowiseError'
import { StatusCodes } from 'http-status-codes'

const defaults = (chatflowId: string): MonitoringPolicyData => ({
    chatflowId,
    enabled: false,
    frequency: 'every_user_message',
    analysisMode: 'sales_qualification',
    language: 'same',
    model: 'fast-monitoring-model',
    contextMessages: 10,
    extractOnlyNewFacts: true,
    confidenceThreshold: 0.7,
    fields: [],
    alertRules: [],
    instructions: { noteLanguage: 'same', noteStyle: 'concise', analyzeBotMessages: false },
    version: 0,
    status: 'draft'
})

function serialize(policy: MonitoringPolicy): MonitoringPolicyData {
    return {
        chatflowId: policy.chatflowId,
        enabled: policy.enabled,
        frequency: policy.frequency as MonitoringPolicyData['frequency'],
        analysisMode: policy.analysisMode,
        language: policy.language,
        model: policy.model,
        contextMessages: policy.contextMessages,
        extractOnlyNewFacts: policy.extractOnlyNewFacts,
        confidenceThreshold: policy.confidenceThreshold,
        crmConnectionId: policy.crmConnectionId,
        fields: JSON.parse(policy.fields || '[]'),
        alertRules: JSON.parse(policy.alertRules || '[]'),
        instructions: JSON.parse(policy.instructions || '{}'),
        version: policy.version,
        status: policy.status as MonitoringPolicyData['status']
    }
}

const service = {
    async getPolicy(chatflowId: string): Promise<MonitoringPolicyData> {
        const repo = getRunningExpressApp().AppDataSource.getRepository(MonitoringPolicy)
        const policy = await repo.findOneBy({ chatflowId })
        return policy ? serialize(policy) : defaults(chatflowId)
    },
    async saveDraft(chatflowId: string, input: Partial<MonitoringPolicyData>): Promise<MonitoringPolicyData> {
        const errors = validateMonitoringPolicy(input)
        if (errors.length) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, errors.join('; '))
        const app = getRunningExpressApp()
        const repo = app.AppDataSource.getRepository(MonitoringPolicy)
        const current = await repo.findOneBy({ chatflowId })
        const data = { ...defaults(chatflowId), ...(current ? serialize(current) : {}), ...input, chatflowId, status: 'draft' as const }
        const entity = repo.create({
            ...(current || {}),
            ...data,
            fields: JSON.stringify(data.fields || []),
            alertRules: JSON.stringify(data.alertRules || []),
            instructions: JSON.stringify(data.instructions || {})
        })
        return serialize(await repo.save(entity))
    },
    async publish(chatflowId: string, changedBy?: string): Promise<MonitoringPolicyData> {
        const app = getRunningExpressApp()
        const repo = app.AppDataSource.getRepository(MonitoringPolicy)
        const versions = app.AppDataSource.getRepository(MonitoringPolicyVersion)
        const policy = await repo.findOneBy({ chatflowId })
        if (!policy) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Monitoring policy not found')
        const data = serialize(policy)
        const errors = validateMonitoringPolicy(data)
        if (errors.length) throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, errors.join('; '))
        policy.version += 1
        policy.status = 'published'
        await repo.save(policy)
        await versions.save(
            versions.create({
                chatflowId,
                version: policy.version,
                policy: JSON.stringify(serialize(policy)),
                changedBy,
                status: 'published'
            })
        )
        return serialize(policy)
    },
    async getVersions(chatflowId: string) {
        return getRunningExpressApp()
            .AppDataSource.getRepository(MonitoringPolicyVersion)
            .find({ where: { chatflowId }, order: { version: 'DESC' } })
    },
    async getHealth(chatflowId: string) {
        const policy = await this.getPolicy(chatflowId)
        return {
            status: policy.enabled ? 'processing' : 'disabled',
            policyVersion: policy.version,
            lastEventReceived: null,
            processed: 0,
            waiting: 0,
            retrying: 0,
            failed: 0
        }
    },
    async ensureChatflow(chatflowId: string) {
        const found = await getRunningExpressApp().AppDataSource.getRepository(ChatFlow).findOneBy({ id: chatflowId })
        if (!found) throw new InternalFlowiseError(StatusCodes.NOT_FOUND, 'Chatflow not found')
    }
}
export default service
