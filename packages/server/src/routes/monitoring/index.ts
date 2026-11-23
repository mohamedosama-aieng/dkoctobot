import express from 'express'
import controller from '../../controllers/monitoring'
import { checkAnyPermission } from '../../enterprise/rbac/PermissionCheck'

const router = express.Router()
const read = checkAnyPermission('chatflows:view,chatflows:update,agentflows:view,agentflows:update')
const write = checkAnyPermission('chatflows:update,agentflows:update')
router.get('/:chatflowId/monitoring-policy', read, controller.getPolicy)
router.put('/:chatflowId/monitoring-policy/draft', write, controller.saveDraft)
router.post('/:chatflowId/monitoring-policy/publish', write, controller.publish)
router.post('/:chatflowId/monitoring-policy/test', read, controller.test)
router.get('/:chatflowId/monitoring-policy/versions', read, controller.versions)
router.get('/:chatflowId/monitoring/health', read, controller.health)
export default router
