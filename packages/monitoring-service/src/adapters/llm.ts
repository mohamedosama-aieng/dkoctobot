import { LlmExtractor, MonitoringEvent, MonitoringPolicy, StructuredExtraction } from '../domain/contracts'

export interface LlmTransport {
    complete(request: { system: string; user: string; jsonSchema: Record<string, unknown> }): Promise<unknown>
}

export class StructuredLlmExtractor implements LlmExtractor {
    constructor(private readonly transport: LlmTransport) {}

    async extract(input: { text: string; event: MonitoringEvent; policy: MonitoringPolicy }): Promise<StructuredExtraction> {
        const fields = input.policy.fields.map((field) => `${field.key}: ${field.displayName || field.key} (${field.type || 'text'})`).join('\n')
        const raw = await this.transport.complete({
            system: `${input.policy.prompt || 'Analyze the customer message professionally and concisely.'}\nExtract only these configured fields; never invent values:\n${fields}`,
            user: input.text,
            jsonSchema: { type: 'object', required: ['summary', 'entities', 'confidence'], properties: { summary: { type: 'string' }, sentiment: { type: 'string' }, entities: { type: 'array' }, confidence: { type: 'number' } } }
        })
        const result = raw as Partial<StructuredExtraction>
        if (typeof result.summary !== 'string' || !Array.isArray(result.entities) || typeof result.confidence !== 'number') {
            throw new Error('LLM returned invalid structured extraction')
        }
        return { summary: result.summary, sentiment: result.sentiment, entities: result.entities, confidence: result.confidence }
    }
}
