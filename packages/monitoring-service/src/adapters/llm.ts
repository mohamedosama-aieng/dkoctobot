import { LlmExtractor, MonitoringEvent, StructuredExtraction } from '../domain/contracts'

export interface LlmTransport {
    complete(request: { system: string; user: string; jsonSchema: Record<string, unknown> }): Promise<unknown>
}

export class StructuredLlmExtractor implements LlmExtractor {
    constructor(private readonly transport: LlmTransport) {}

    async extract(input: { text: string; event: MonitoringEvent }): Promise<StructuredExtraction> {
        const raw = await this.transport.complete({
            system: 'Extract only the requested JSON fields from the supplied text.',
            user: input.text,
            jsonSchema: { type: 'object', required: ['summary', 'entities', 'confidence'] }
        })
        const result = raw as Partial<StructuredExtraction>
        if (typeof result.summary !== 'string' || !Array.isArray(result.entities) || typeof result.confidence !== 'number') {
            throw new Error('LLM returned invalid structured extraction')
        }
        return { summary: result.summary, sentiment: result.sentiment, entities: result.entities, confidence: result.confidence }
    }
}
