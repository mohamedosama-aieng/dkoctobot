import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, Box, Button, Chip, Divider, MenuItem, Paper, Stack, Switch, Tab, Tabs, TextField, Typography } from '@mui/material'
import { IconDeviceFloppy, IconPlus, IconRocket, IconTrash } from '@tabler/icons-react'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import MainCard from '@/ui-component/cards/MainCard'
import monitoringApi from '@/api/crmMonitoring'

const emptyField = () => ({ key: '', displayName: '', type: 'text', required: false, enabled: true, position: 1, options: [] })
const emptyAlert = () => ({
    id: `alert_${Date.now()}`,
    name: '',
    enabled: true,
    conditions: [{ field: '', operator: 'equals', value: '' }],
    logic: 'all',
    level: 'warning',
    reason: ''
})

const statusColor = { draft: 'warning', published: 'success', disabled: 'default', processing: 'info' }

export default function PolicyBuilder() {
    const { chatflowId } = useParams()
    const [policy, setPolicy] = useState(null)
    const [tab, setTab] = useState(0)
    const [message, setMessage] = useState('')
    const [testResult, setTestResult] = useState(null)
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        monitoringApi
            .getPolicy(chatflowId)
            .then((res) => setPolicy(res.data))
            .catch((e) => setError(e.message))
    }, [chatflowId])
    if (!policy)
        return (
            <Box sx={{ p: 3 }}>
                <Typography>Loading monitoring policy...</Typography>
            </Box>
        )

    const update = (key, value) => setPolicy({ ...policy, [key]: value })
    const updateField = (index, key, value) =>
        update(
            'fields',
            policy.fields.map((field, i) => (i === index ? { ...field, [key]: value } : field))
        )
    const updateAlert = (index, key, value) =>
        update(
            'alertRules',
            policy.alertRules.map((alert, i) => (i === index ? { ...alert, [key]: value } : alert))
        )
    const saveDraft = async () => {
        setSaving(true)
        setError('')
        try {
            const res = await monitoringApi.saveDraft(chatflowId, policy)
            setPolicy(res.data)
        } catch (e) {
            setError(e.response?.data?.message || e.message)
        } finally {
            setSaving(false)
        }
    }
    const publish = async () => {
        setSaving(true)
        setError('')
        try {
            const res = await monitoringApi.publish(chatflowId)
            setPolicy(res.data)
        } catch (e) {
            setError(e.response?.data?.message || e.message)
        } finally {
            setSaving(false)
        }
    }
    const runTest = async () => {
        setSaving(true)
        setError('')
        try {
            const res = await monitoringApi.test(chatflowId, { message })
            setTestResult(res.data)
        } catch (e) {
            setError(e.response?.data?.message || e.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <>
            <ViewHeader title='CRM Monitoring' description={`Policy for Chatflow ${chatflowId}`} />
            <MainCard>
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    justifyContent='space-between'
                    alignItems={{ md: 'center' }}
                    spacing={2}
                    sx={{ mb: 2 }}
                >
                    <Stack direction='row' spacing={1} alignItems='center'>
                        <Chip label={policy.enabled ? 'Enabled' : 'Disabled'} color={policy.enabled ? 'success' : 'default'} />
                        <Chip label={policy.status} color={statusColor[policy.status] || 'default'} variant='outlined' />
                        <Typography variant='body2' color='text.secondary'>
                            Version {policy.version}
                        </Typography>
                    </Stack>
                    <Stack direction='row' spacing={1}>
                        <Button startIcon={<IconDeviceFloppy size={17} />} onClick={saveDraft} disabled={saving}>
                            Save Draft
                        </Button>
                        <Button variant='contained' startIcon={<IconRocket size={17} />} onClick={publish} disabled={saving}>
                            Publish
                        </Button>
                    </Stack>
                </Stack>
                {error && (
                    <Alert severity='error' sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}
                <Tabs
                    value={tab}
                    onChange={(_, value) => setTab(value)}
                    variant='scrollable'
                    sx={{ borderBottom: 1, borderColor: 'divider' }}
                >
                    <Tab label='Overview' />
                    <Tab label='Fields' />
                    <Tab label='Alerts' />
                    <Tab label='Instructions' />
                    <Tab label='Test' />
                </Tabs>
                <Box sx={{ pt: 3 }}>
                    {tab === 0 && (
                        <Stack spacing={2} maxWidth={720}>
                            <Stack direction='row' alignItems='center' justifyContent='space-between'>
                                <Typography>Enable monitoring for every user message</Typography>
                                <Switch checked={policy.enabled} onChange={(e) => update('enabled', e.target.checked)} />
                            </Stack>
                            <TextField
                                select
                                label='Analysis mode'
                                value={policy.analysisMode}
                                onChange={(e) => update('analysisMode', e.target.value)}
                            >
                                <MenuItem value='sales_qualification'>Sales Qualification</MenuItem>
                                <MenuItem value='customer_support'>Customer Support</MenuItem>
                                <MenuItem value='complaint_detection'>Complaint Detection</MenuItem>
                                <MenuItem value='custom'>Custom</MenuItem>
                            </TextField>
                            <TextField
                                select
                                label='Frequency'
                                value={policy.frequency}
                                onChange={(e) => update('frequency', e.target.value)}
                            >
                                <MenuItem value='every_user_message'>Every user message</MenuItem>
                                <MenuItem value='important_messages'>Important messages</MenuItem>
                                <MenuItem value='session_end'>Session end</MenuItem>
                            </TextField>
                            <TextField
                                label='CRM connection ID'
                                value={policy.crmConnectionId || ''}
                                onChange={(e) => update('crmConnectionId', e.target.value)}
                                helperText='The credential remains server-side.'
                            />
                        </Stack>
                    )}
                    {tab === 1 && (
                        <Stack spacing={2}>
                            <Typography variant='body2' color='text.secondary'>
                                Disabled fields remain in policy history and are not extracted.
                            </Typography>
                            {policy.fields.map((field, index) => (
                                <Paper key={`${field.key}-${index}`} variant='outlined' sx={{ p: 2 }}>
                                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                                        <Switch checked={field.enabled} onChange={(e) => updateField(index, 'enabled', e.target.checked)} />
                                        <TextField
                                            size='small'
                                            label='Key'
                                            value={field.key}
                                            onChange={(e) => updateField(index, 'key', e.target.value)}
                                        />
                                        <TextField
                                            size='small'
                                            label='Display name'
                                            value={field.displayName}
                                            onChange={(e) => updateField(index, 'displayName', e.target.value)}
                                        />
                                        <TextField
                                            select
                                            size='small'
                                            label='Type'
                                            value={field.type}
                                            onChange={(e) => updateField(index, 'type', e.target.value)}
                                        >
                                            <MenuItem value='text'>Text</MenuItem>
                                            <MenuItem value='number'>Number</MenuItem>
                                            <MenuItem value='boolean'>Boolean</MenuItem>
                                            <MenuItem value='select'>Select</MenuItem>
                                        </TextField>
                                        <Button
                                            color='error'
                                            aria-label='Delete field'
                                            onClick={() =>
                                                update(
                                                    'fields',
                                                    policy.fields.filter((_, i) => i !== index)
                                                )
                                            }
                                        >
                                            <IconTrash size={18} />
                                        </Button>
                                    </Stack>
                                    {field.type === 'select' && (
                                        <TextField
                                            fullWidth
                                            size='small'
                                            sx={{ mt: 1 }}
                                            label='Options (comma separated)'
                                            value={(field.options || []).join(', ')}
                                            onChange={(e) =>
                                                updateField(
                                                    index,
                                                    'options',
                                                    e.target.value
                                                        .split(',')
                                                        .map((v) => v.trim())
                                                        .filter(Boolean)
                                                )
                                            }
                                        />
                                    )}
                                </Paper>
                            ))}
                            <Button
                                startIcon={<IconPlus size={17} />}
                                variant='outlined'
                                onClick={() =>
                                    update('fields', [...policy.fields, { ...emptyField(), position: policy.fields.length + 1 }])
                                }
                            >
                                Add field
                            </Button>
                        </Stack>
                    )}
                    {tab === 2 && (
                        <Stack spacing={2}>
                            {policy.alertRules.map((alert, index) => (
                                <Paper key={alert.id} variant='outlined' sx={{ p: 2 }}>
                                    <Stack spacing={1}>
                                        <Stack direction='row' alignItems='center' justifyContent='space-between'>
                                            <Stack direction='row' alignItems='center'>
                                                <Switch
                                                    checked={alert.enabled}
                                                    onChange={(e) => updateAlert(index, 'enabled', e.target.checked)}
                                                />
                                                <Typography variant='subtitle1'>{alert.name || 'New alert'}</Typography>
                                            </Stack>
                                            <Button
                                                color='error'
                                                aria-label='Delete alert'
                                                onClick={() =>
                                                    update(
                                                        'alertRules',
                                                        policy.alertRules.filter((_, i) => i !== index)
                                                    )
                                                }
                                            >
                                                <IconTrash size={18} />
                                            </Button>
                                        </Stack>
                                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                                            <TextField
                                                fullWidth
                                                size='small'
                                                label='Alert name'
                                                value={alert.name}
                                                onChange={(e) => updateAlert(index, 'name', e.target.value)}
                                            />
                                            <TextField
                                                select
                                                size='small'
                                                label='Level'
                                                value={alert.level}
                                                onChange={(e) => updateAlert(index, 'level', e.target.value)}
                                            >
                                                <MenuItem value='none'>None</MenuItem>
                                                <MenuItem value='warning'>Warning</MenuItem>
                                                <MenuItem value='danger'>Danger</MenuItem>
                                            </TextField>
                                        </Stack>
                                        <TextField
                                            fullWidth
                                            size='small'
                                            label='Field'
                                            value={alert.conditions[0]?.field || ''}
                                            onChange={(e) =>
                                                updateAlert(index, 'conditions', [{ ...alert.conditions[0], field: e.target.value }])
                                            }
                                        />
                                        <TextField
                                            fullWidth
                                            size='small'
                                            label='Reason'
                                            value={alert.reason}
                                            onChange={(e) => updateAlert(index, 'reason', e.target.value)}
                                        />
                                    </Stack>
                                </Paper>
                            ))}
                            <Button
                                startIcon={<IconPlus size={17} />}
                                variant='outlined'
                                onClick={() => update('alertRules', [...policy.alertRules, emptyAlert()])}
                            >
                                Add alert
                            </Button>
                        </Stack>
                    )}
                    {tab === 3 && (
                        <Stack spacing={2} maxWidth={720}>
                            <TextField
                                select
                                label='Note language'
                                value={policy.instructions.noteLanguage || 'same'}
                                onChange={(e) => update('instructions', { ...policy.instructions, noteLanguage: e.target.value })}
                            >
                                <MenuItem value='same'>Same as customer</MenuItem>
                                <MenuItem value='ar'>Arabic</MenuItem>
                                <MenuItem value='en'>English</MenuItem>
                            </TextField>
                            <TextField
                                select
                                label='Note style'
                                value={policy.instructions.noteStyle || 'concise'}
                                onChange={(e) => update('instructions', { ...policy.instructions, noteStyle: e.target.value })}
                            >
                                <MenuItem value='concise'>Concise</MenuItem>
                                <MenuItem value='detailed'>Detailed</MenuItem>
                            </TextField>
                            <Stack direction='row' justifyContent='space-between' alignItems='center'>
                                <Typography>Analyze bot messages</Typography>
                                <Switch
                                    checked={Boolean(policy.instructions.analyzeBotMessages)}
                                    onChange={(e) =>
                                        update('instructions', { ...policy.instructions, analyzeBotMessages: e.target.checked })
                                    }
                                />
                            </Stack>
                            <TextField
                                type='number'
                                label='Context messages'
                                inputProps={{ min: 1, max: 50 }}
                                value={policy.contextMessages}
                                onChange={(e) => update('contextMessages', Number(e.target.value))}
                            />
                            <TextField
                                type='number'
                                label='Confidence threshold'
                                inputProps={{ min: 0, max: 1, step: 0.05 }}
                                value={policy.confidenceThreshold}
                                onChange={(e) => update('confidenceThreshold', Number(e.target.value))}
                            />
                        </Stack>
                    )}
                    {tab === 4 && (
                        <Stack spacing={2} maxWidth={800}>
                            <TextField
                                multiline
                                minRows={5}
                                label='Test customer message'
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder='Enter a message to analyze without writing to CRM'
                            />
                            <Button variant='contained' onClick={runTest} disabled={saving || !message}>
                                Run test
                            </Button>
                            {testResult && (
                                <Paper variant='outlined' sx={{ p: 2 }}>
                                    <Typography variant='subtitle1'>Test result</Typography>
                                    <Divider sx={{ my: 1 }} />
                                    <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(testResult, null, 2)}</pre>
                                </Paper>
                            )}
                        </Stack>
                    )}
                </Box>
            </MainCard>
        </>
    )
}
