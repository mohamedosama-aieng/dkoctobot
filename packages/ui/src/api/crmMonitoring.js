import client from './client'

const path = (chatflowId) => `/chatflows/${chatflowId}`
const getPolicy = (chatflowId) => client.get(`${path(chatflowId)}/monitoring-policy`)
const saveDraft = (chatflowId, policy) => client.put(`${path(chatflowId)}/monitoring-policy/draft`, policy)
const publish = (chatflowId) => client.post(`${path(chatflowId)}/monitoring-policy/publish`)
const test = (chatflowId, data) => client.post(`${path(chatflowId)}/monitoring-policy/test`, data)
const getVersions = (chatflowId) => client.get(`${path(chatflowId)}/monitoring-policy/versions`)
const getHealth = (chatflowId) => client.get(`${path(chatflowId)}/monitoring/health`)

export default { getPolicy, saveDraft, publish, test, getVersions, getHealth }
