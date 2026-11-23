import { NextFunction, Request, Response } from 'express'
import monitoringService from '../../services/monitoring'

const withChatflow = async (req: Request, res: Response, next: NextFunction, action: () => Promise<unknown>) => {
    try {
        await monitoringService.ensureChatflow(req.params.chatflowId)
        return res.json(await action())
    } catch (error) {
        next(error)
    }
}
const getPolicy = (req: Request, res: Response, next: NextFunction) =>
    withChatflow(req, res, next, () => monitoringService.getPolicy(req.params.chatflowId))
const saveDraft = (req: Request, res: Response, next: NextFunction) =>
    withChatflow(req, res, next, () => monitoringService.saveDraft(req.params.chatflowId, req.body || {}))
const publish = (req: Request, res: Response, next: NextFunction) =>
    withChatflow(req, res, next, () => monitoringService.publish(req.params.chatflowId, req.user?.id))
const versions = (req: Request, res: Response, next: NextFunction) =>
    withChatflow(req, res, next, () => monitoringService.getVersions(req.params.chatflowId))
const health = (req: Request, res: Response, next: NextFunction) =>
    withChatflow(req, res, next, () => monitoringService.getHealth(req.params.chatflowId))
const test = (req: Request, res: Response, next: NextFunction) =>
    withChatflow(req, res, next, async () => ({
        message: req.body?.message || '',
        facts: {},
        sentiment: 'neutral',
        matchedAlerts: [],
        payload: null,
        warnings: ['Test execution requires a configured monitoring worker']
    }))
export default { getPolicy, saveDraft, publish, versions, health, test }
