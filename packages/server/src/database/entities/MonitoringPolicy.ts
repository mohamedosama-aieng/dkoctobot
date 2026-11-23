import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'

@Entity()
export class MonitoringPolicy {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Index({ unique: true })
    @Column()
    chatflowId: string

    @Column({ default: false })
    enabled: boolean

    @Column({ default: 'every_user_message' })
    frequency: string

    @Column({ default: 'sales_qualification' })
    analysisMode: string

    @Column({ default: 'same' })
    language: string

    @Column({ default: 'fast-monitoring-model' })
    model: string

    @Column({ default: 10 })
    contextMessages: number

    @Column({ default: true })
    extractOnlyNewFacts: boolean

    @Column({ type: 'float', default: 0.7 })
    confidenceThreshold: number

    @Column({ nullable: true })
    crmConnectionId?: string

    @Column({ type: 'text' })
    fields: string

    @Column({ type: 'text' })
    alertRules: string

    @Column({ type: 'text' })
    instructions: string

    @Column({ default: 0 })
    version: number

    @Column({ default: 'draft' })
    status: string

    @Column({ type: 'timestamp' })
    @CreateDateColumn()
    createdDate: Date

    @Column({ type: 'timestamp' })
    @UpdateDateColumn()
    updatedDate: Date
}
