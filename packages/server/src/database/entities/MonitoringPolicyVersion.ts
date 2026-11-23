import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class MonitoringPolicyVersion {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Index()
    @Column()
    chatflowId: string

    @Index()
    @Column()
    version: number

    @Column({ type: 'text' })
    policy: string

    @Column({ nullable: true })
    changedBy?: string

    @Column({ default: 'published' })
    status: string

    @Column({ type: 'timestamp' })
    @CreateDateColumn()
    createdDate: Date
}
