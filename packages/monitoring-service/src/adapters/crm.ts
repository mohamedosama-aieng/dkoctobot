import { Alert, CrmAlertClient, CrmMonitoringClient, CrmMonitoringNote } from '../domain/contracts'

export interface HttpTransport {
    request(options: {
        method: string
        url: string
        headers: Record<string, string>
        body: string
        signal: AbortSignal
    }): Promise<{ status: number; text(): Promise<string> }>
}

export class FetchHttpTransport implements HttpTransport {
    async request(options: Parameters<HttpTransport['request']>[0]) {
        return fetch(options.url, options as RequestInit)
    }
}

export class HttpCrmAlertClient implements CrmAlertClient {
    constructor(
        private readonly baseUrl: string,
        private readonly token: string | undefined,
        private readonly timeoutMs = 10000,
        private readonly http: HttpTransport = new FetchHttpTransport()
    ) {}

    async createAlert(alert: Alert, idempotencyKey: string): Promise<{ externalId: string }> {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), this.timeoutMs)
        try {
            const response = await this.http.request({
                method: 'POST',
                url: `${this.baseUrl.replace(/\/$/, '')}/alerts`,
                headers: {
                    'content-type': 'application/json',
                    'idempotency-key': idempotencyKey,
                    ...(this.token ? { authorization: `Bearer ${this.token}` } : {})
                },
                body: JSON.stringify(alert),
                signal: controller.signal
            })
            if (response.status < 200 || response.status >= 300)
                throw new Error(`CRM alert request failed (${response.status}): ${await response.text()}`)
            const body = JSON.parse(await response.text()) as { id?: string; externalId?: string }
            const externalId = body.externalId || body.id
            if (!externalId) throw new Error('CRM response did not include an alert id')
            return { externalId }
        } finally {
            clearTimeout(timer)
        }
    }
}

export class HttpCrmMonitoringClient implements CrmMonitoringClient {
    constructor(
        private readonly baseUrl: string,
        private readonly apiKey: string,
        private readonly timeoutMs = 10000,
        private readonly http: HttpTransport = new FetchHttpTransport()
    ) {}

    async sendNote(note: CrmMonitoringNote): Promise<{ duplicate?: boolean; id?: string }> {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), this.timeoutMs)
        try {
            const response = await this.http.request({
                method: 'POST',
                url: `${this.baseUrl.replace(/\/$/, '')}/api/integration/monitoring/note`,
                headers: { 'content-type': 'application/json', 'x-api-key': this.apiKey, 'idempotency-key': note.eventId },
                body: JSON.stringify(note),
                signal: controller.signal
            })
            if (response.status < 200 || response.status >= 300)
                throw new Error(`CRM monitoring request failed (${response.status}): ${await response.text()}`)
            const body = JSON.parse(await response.text()) as { duplicate?: boolean; id?: string }
            return { duplicate: body.duplicate, id: body.id }
        } finally {
            clearTimeout(timer)
        }
    }
}
