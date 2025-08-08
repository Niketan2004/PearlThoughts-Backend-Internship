import {
     Entity,
     Column,
     OneToOne,
     CreateDateColumn,
     UpdateDateColumn,
     PrimaryColumn,
     OneToMany,
     JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { DoctorAvailability } from './doctor-availability.entity';
import { DoctorTimeSlot } from './doctor-time-slot.entity';
import { ScheduleType } from '../enums/schedule-type.enums';
import { Appointment } from '../../appointments/entities/appointment.entity';

@Entity('doctors')
export class Doctor {
     @PrimaryColumn()
     user_id: number;

     @Column({ type: 'varchar', length: 255 })
     education: string;

     @Column({ type: 'varchar', length: 100 })
     specialization: string;

     @Column({ type: 'int' })
     experience_years: number;

     @Column({ type: 'varchar', length: 255 })
     clinic_name: string;

     @Column({ type: 'text' })
     clinic_address: string;

     @Column({
          type: 'enum',
          enum: ScheduleType,
          default: ScheduleType.WAVE,
          name: 'schedule_type',
     })
     schedule_type: ScheduleType;

     @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
     consultation_fee: number;

     @Column({ type: 'text', nullable: true })
     about: string;

     @CreateDateColumn()
     created_at: Date;

     @UpdateDateColumn()
     updated_at: Date;

     // Relationships
     @OneToOne(() => User, (user) => user.doctor, { onDelete: 'CASCADE' })
     @JoinColumn({ name: 'user_id' })
     user: User;

     @OneToMany(() => DoctorAvailability, (availability) => availability.doctor)
     availabilities: DoctorAvailability[];

     @OneToMany(() => DoctorTimeSlot, (slot) => slot.doctor)
     time_slots: DoctorTimeSlot[];

     @OneToMany(() => Appointment, (appointment) => appointment.doctor)
     appointments: Appointment[];
}
