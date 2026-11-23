import { MigrationInterface, QueryRunner } from 'typeorm'
export class AddMonitoringPolicy1773000000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "monitoring_policy" ("id" uuid PRIMARY KEY NOT NULL, "chatflowId" varchar NOT NULL UNIQUE, "enabled" boolean NOT NULL DEFAULT false, "frequency" varchar NOT NULL DEFAULT 'every_user_message', "analysisMode" varchar NOT NULL DEFAULT 'sales_qualification', "language" varchar NOT NULL DEFAULT 'same', "model" varchar NOT NULL DEFAULT 'fast-monitoring-model', "contextMessages" integer NOT NULL DEFAULT 10, "extractOnlyNewFacts" boolean NOT NULL DEFAULT true, "confidenceThreshold" double precision NOT NULL DEFAULT 0.7, "crmConnectionId" varchar, "fields" text NOT NULL, "alertRules" text NOT NULL, "instructions" text NOT NULL, "version" integer NOT NULL DEFAULT 0, "status" varchar NOT NULL DEFAULT 'draft', "createdDate" TIMESTAMP NOT NULL DEFAULT now(), "updatedDate" TIMESTAMP NOT NULL DEFAULT now())`
        )
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "monitoring_policy_version" ("id" uuid PRIMARY KEY NOT NULL, "chatflowId" varchar NOT NULL, "version" integer NOT NULL, "policy" text NOT NULL, "changedBy" varchar, "status" varchar NOT NULL DEFAULT 'published', "createdDate" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_monitoring_policy_version" UNIQUE ("chatflowId", "version"))`
        )
    }
    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query('DROP TABLE IF EXISTS "monitoring_policy_version"')
        await queryRunner.query('DROP TABLE IF EXISTS "monitoring_policy"')
    }
}
