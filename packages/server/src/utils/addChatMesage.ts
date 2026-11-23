import { DataSource } from 'typeorm'
import { ChatMessage } from '../database/entities/ChatMessage'
import { IChatMessage } from '../Interface'
import { getRunningExpressApp } from '../utils/getRunningExpressApp'
import { publishMonitoringEvent } from './monitoringPublisher'
import { MonitoringPolicy } from '../database/entities/MonitoringPolicy'

/**
 * Method that add chat messages.
 * @param {Partial<IChatMessage>} chatMessage
 */
export const utilAddChatMessage = async (chatMessage: Partial<IChatMessage>, appDataSource?: DataSource): Promise<ChatMessage> => {
    const dataSource = appDataSource ?? getRunningExpressApp().AppDataSource
    const newChatMessage = new ChatMessage()
    Object.assign(newChatMessage, chatMessage)
    if (!newChatMessage.createdDate) {
        newChatMessage.createdDate = new Date()
    }
    const chatmessage = await dataSource.getRepository(ChatMessage).create(newChatMessage)
    const dbResponse = await dataSource.getRepository(ChatMessage).save(chatmessage)
    if (dbResponse.role === 'userMessage') {
        void dataSource
            .getRepository(MonitoringPolicy)
            .findOneBy({ chatflowId: dbResponse.chatflowid })
            .then((policy) => {
                const policyEnabled = policy?.enabled && policy.status === 'published' && policy.frequency === 'every_user_message'
                const crmMonitoringEnabled = process.env.MONITORING_EVENTS_ALL_USER_MESSAGES === 'true'
                if (policyEnabled || crmMonitoringEnabled) {
                    return publishMonitoringEvent({
                        chatflowId: dbResponse.chatflowid,
                        chatId: dbResponse.chatId,
                        sessionId: dbResponse.sessionId,
                        messageId: dbResponse.id,
                        role: 'userMessage',
                        content: dbResponse.content,
                        createdAt: dbResponse.createdDate.toISOString(),
                        policyVersion: policy?.version ?? 0
                    })
                }
                return undefined
            })
            .catch(() => undefined)
    }
    return dbResponse
}
