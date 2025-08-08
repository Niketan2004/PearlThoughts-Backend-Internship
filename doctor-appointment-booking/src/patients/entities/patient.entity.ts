import {
     Entity,
     Column,
     OneToOne,
     JoinColumn,
     CreateDateColumn,
     UpdateDateColumn,
     PrimaryColumn,
     OneToMany,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Appointment } from '../../appointments/entities/appointment.entity';

@Entity('patients')
export class Patient {
     @PrimaryColumn()
     user_id: number;

     @Column({ type: 'int', nullable: true })
     age: number;

     @Column({ type: 'varchar', length: 10, nullable: true })
     gender: string;

     @Column({ type: 'text', nullable: true })
     address: string;

     @Column({ type: 'varchar', length: 15, nullable: true })
     emergency_contact: string;

     @Column({ type: 'text', nullable: true })
     medical_history: string;

     @Column({ type: 'text', nullable: true })
     allergies: string;

     @Column({ type: 'text', nullable: true })
     current_medications: string;

     @CreateDateColumn()
     created_at: Date;

     @UpdateDateColumn()
     updated_at: Date;

     // Relations
     @OneToOne(() => User, (user) => user.patient, { onDelete: 'CASCADE' })
     @JoinColumn({ name: 'user_id' })
     user: User;

     @OneToMany(() => Appointment, (appointment) => appointment.patient)
     appointments: Appointment[];
}
