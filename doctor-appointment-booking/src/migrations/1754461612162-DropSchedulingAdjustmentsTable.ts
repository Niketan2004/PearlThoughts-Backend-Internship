import { MigrationInterface, QueryRunner } from "typeorm";

export class DropSchedulingAdjustmentsTable1754461612162 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop the scheduling_adjustments table as we removed the SchedulingAdjustment entity
        await queryRunner.query(`DROP TABLE IF EXISTS "scheduling_adjustments"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Recreate the scheduling_adjustments table if needed for rollback
        await queryRunner.query(`
            CREATE TABLE "scheduling_adjustments" (
                "adjustment_id" SERIAL NOT NULL,
                "adjustment_type" character varying NOT NULL,
                "original_start_time" TIME,
                "original_end_time" TIME,
                "new_start_time" TIME,
                "new_end_time" TIME,
                "new_capacity" integer,
                "consultation_duration_minutes" integer,
                "reason" character varying,
                "notes" text,
                "status" character varying NOT NULL DEFAULT 'pending',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "applied_at" TIMESTAMP,
                "availability_id" integer NOT NULL,
                CONSTRAINT "PK_9f8c9c0c4c5a5a9e0e9a7b0e0e0e" PRIMARY KEY ("adjustment_id")
            )
        `);

        await queryRunner.query(`
            ALTER TABLE "scheduling_adjustments" 
            ADD CONSTRAINT "FK_scheduling_adjustments_availability" 
            FOREIGN KEY ("availability_id") 
            REFERENCES "doctor_availabilities"("availability_id") 
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

}
