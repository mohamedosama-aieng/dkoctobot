import { MigrationInterface, QueryRunner } from 'typeorm'
export class AddMonitoringPolicy1773000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS monitoring_policy (id varchar(36) NOT NULL PRIMARY KEY, chatflowId varchar(255) NOT NULL UNIQUE, enabled boolean NOT NULL DEFAULT false, frequency varchar(255) NOT NULL DEFAULT 'every_user_message', analysisMode varchar(255) NOT NULL DEFAULT 'sales_qualification', language varchar(255) NOT NULL DEFAULT 'same', model varchar(255) NOT NULL DEFAULT 'fast-monitoring-model', contextMessages int NOT NULL DEFAULT 10, extractOnlyNewFacts boolean NOT NULL DEFAULT true, confidenceThreshold double NOT NULL DEFAULT 0.7, crmConnectionId varchar(255), fields text NOT NULL, alertRules text NOT NULL, instructions text NOT NULL, version int NOT NULL DEFAULT 0, status varchar(255) NOT NULL DEFAULT 'draft', createdDate datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedDate datetime NOT NULL DEFAULT CURRENT_TIMESTAMP)`
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS monitoring_policy_version (id varchar(36) NOT NULL PRIMARY KEY, chatflowId varchar(255) NOT NULL, version int NOT NULL, policy text NOT NULL, changedBy varchar(255), status varchar(255) NOT NULL DEFAULT 'published', createdDate datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY UQ_monitoring_policy_version (chatflowId, version))`
        )
    }
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS monitoring_policy_version')
        await queryRunner.query('DROP TABLE IF EXISTS monitoring_policy')
    }
}
