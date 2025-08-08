import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAppointmentSystem1721158400000 implements MigrationInterface {
     name = 'CreateAppointmentSystem1721158400000'

     public async up(queryRunner: QueryRunner): Promise<void> {
          // Create user role enum
          await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('doctor', 'patient')`);

          // Create account status enum
          await queryRunner.query(`CREATE TYPE "public"."users_account_status_enum" AS ENUM('active', 'inactive', 'suspended')`);

          // Create schedule type enum
          await queryRunner.query(`CREATE TYPE "public"."doctors_schedule_type_enum" AS ENUM('wave', 'slot')`);

          // Create session enum
          await queryRunner.query(`CREATE TYPE "public"."doctor_availabilities_session_enum" AS ENUM('morning', 'afternoon', 'evening')`);

          // Create weekday enum
          await queryRunner.query(`CREATE TYPE "public"."doctor_availabilities_weekdays_enum" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')`);

          // Create time slot status enum
          await queryRunner.query(`CREATE TYPE "public"."doctor_time_slots_status_enum" AS ENUM('available', 'booked', 'blocked')`);

          // Create appointment status enum
          await queryRunner.query(`CREATE TYPE "public"."appointments_appointment_status_enum" AS ENUM('scheduled', 'cancelled', 'completed')`);

          // Create users table
          await queryRunner.query(`
            CREATE TABLE "users" (
                "user_id" SERIAL NOT NULL,
                "full_name" character varying(100) NOT NULL,
                "email" character varying NOT NULL,
                "password" character varying,
                "phone" character varying(15),
                "role" "public"."users_role_enum" NOT NULL,
                "account_status" "public"."users_account_status_enum" NOT NULL DEFAULT 'active',
                "profile_picture" character varying,
                "date_of_birth" date,
                "gender" character varying,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_users_email" UNIQUE ("email"),
                CONSTRAINT "PK_users" PRIMARY KEY ("user_id")
            )
        `);

          // Create doctors table
          await queryRunner.query(`
            CREATE TABLE "doctors" (
                "user_id" integer NOT NULL,
                "education" character varying(255) NOT NULL,
                "specialization" character varying(100) NOT NULL,
                "experience_years" integer NOT NULL,
                "clinic_name" character varying(255) NOT NULL,
                "clinic_address" text NOT NULL,
                "schedule_type" "public"."doctors_schedule_type_enum" NOT NULL DEFAULT 'wave',
                "consultation_fee" numeric(10,2),
                "about" text,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_doctors" PRIMARY KEY ("user_id")
            )
        `);

          // Create patients table
          await queryRunner.query(`
            CREATE TABLE "patients" (
                "user_id" integer NOT NULL,
                "age" integer,
                "gender" character varying(10),
                "address" text,
                "emergency_contact" character varying(15),
                "medical_history" text,
                "allergies" text,
                "current_medications" text,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_patients" PRIMARY KEY ("user_id")
            )
        `);

          // Create doctor_availabilities table
          await queryRunner.query(`
            CREATE TABLE "doctor_availabilities" (
                "availability_id" SERIAL NOT NULL,
                "date" date NOT NULL,
                "consulting_start_time" time NOT NULL,
                "consulting_end_time" time NOT NULL,
                "session" "public"."doctor_availabilities_session_enum" NOT NULL,
                "weekdays" "public"."doctor_availabilities_weekdays_enum" array,
                "booking_start_at" TIMESTAMP NOT NULL,
                "booking_end_at" TIMESTAMP NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "is_deleted" boolean NOT NULL DEFAULT false,
                "doctor_id" integer,
                CONSTRAINT "PK_doctor_availabilities" PRIMARY KEY ("availability_id")
            )
        `);

          // Create doctor_time_slots table
          await queryRunner.query(`
            CREATE TABLE "doctor_time_slots" (
                "timeslot_id" SERIAL NOT NULL,
                "start_time" time NOT NULL,
                "end_time" time NOT NULL,
                "status" "public"."doctor_time_slots_status_enum" NOT NULL DEFAULT 'available',
                "max_patients" integer NOT NULL,
                "is_deleted" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "doctor_id" integer,
                "availability_id" integer,
                CONSTRAINT "PK_doctor_time_slots" PRIMARY KEY ("timeslot_id")
            )
        `);

          // Create appointments table
          await queryRunner.query(`
            CREATE TABLE "appointments" (
                "appointment_id" SERIAL NOT NULL,
                "appointment_status" "public"."appointments_appointment_status_enum" NOT NULL DEFAULT 'scheduled',
                "scheduled_on" TIMESTAMP NOT NULL,
                "reason" character varying,
                "notes" text,
                "prescription" text,
                "diagnosis" text,
                "amount_paid" numeric(10,2),
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                "doctor_id" integer,
                "patient_id" integer,
                "time_slot_id" integer,
                CONSTRAINT "UQ_appointments_patient_timeslot" UNIQUE ("patient_id", "time_slot_id"),
                CONSTRAINT "PK_appointments" PRIMARY KEY ("appointment_id")
            )
        `);

          // Add foreign key constraints
          await queryRunner.query(`ALTER TABLE "doctors" ADD CONSTRAINT "FK_doctors_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
          await queryRunner.query(`ALTER TABLE "patients" ADD CONSTRAINT "FK_patients_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
          await queryRunner.query(`ALTER TABLE "doctor_availabilities" ADD CONSTRAINT "FK_doctor_availabilities_doctor_id" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
          await queryRunner.query(`ALTER TABLE "doctor_time_slots" ADD CONSTRAINT "FK_doctor_time_slots_doctor_id" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("user_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
          await queryRunner.query(`ALTER TABLE "doctor_time_slots" ADD CONSTRAINT "FK_doctor_time_slots_availability_id" FOREIGN KEY ("availability_id") REFERENCES "doctor_availabilities"("availability_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
          await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_appointments_doctor_id" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
          await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_appointments_patient_id" FOREIGN KEY ("patient_id") REFERENCES "patients"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
          await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_appointments_time_slot_id" FOREIGN KEY ("time_slot_id") REFERENCES "doctor_time_slots"("timeslot_id") ON DELETE CASCADE ON UPDATE NO ACTION`);
     }

     public async down(queryRunner: QueryRunner): Promise<void> {
          // Drop foreign key constraints
          await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_appointments_time_slot_id"`);
          await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_appointments_patient_id"`);
          await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_appointments_doctor_id"`);
          await queryRunner.query(`ALTER TABLE "doctor_time_slots" DROP CONSTRAINT "FK_doctor_time_slots_availability_id"`);
          await queryRunner.query(`ALTER TABLE "doctor_time_slots" DROP CONSTRAINT "FK_doctor_time_slots_doctor_id"`);
          await queryRunner.query(`ALTER TABLE "doctor_availabilities" DROP CONSTRAINT "FK_doctor_availabilities_doctor_id"`);
          await queryRunner.query(`ALTER TABLE "patients" DROP CONSTRAINT "FK_patients_user_id"`);
          await queryRunner.query(`ALTER TABLE "doctors" DROP CONSTRAINT "FK_doctors_user_id"`);

          // Drop tables
          await queryRunner.query(`DROP TABLE "appointments"`);
          await queryRunner.query(`DROP TABLE "doctor_time_slots"`);
          await queryRunner.query(`DROP TABLE "doctor_availabilities"`);
          await queryRunner.query(`DROP TABLE "patients"`);
          await queryRunner.query(`DROP TABLE "doctors"`);
          await queryRunner.query(`DROP TABLE "users"`);

          // Drop enums
          await queryRunner.query(`DROP TYPE "public"."appointments_appointment_status_enum"`);
          await queryRunner.query(`DROP TYPE "public"."doctor_time_slots_status_enum"`);
          await queryRunner.query(`DROP TYPE "public"."doctor_availabilities_weekdays_enum"`);
          await queryRunner.query(`DROP TYPE "public"."doctor_availabilities_session_enum"`);
          await queryRunner.query(`DROP TYPE "public"."doctors_schedule_type_enum"`);
          await queryRunner.query(`DROP TYPE "public"."users_account_status_enum"`);
          await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
     }
}
