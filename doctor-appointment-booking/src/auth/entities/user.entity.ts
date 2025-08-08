import {
     Entity,
     PrimaryGeneratedColumn,
     Column,
     CreateDateColumn,
     UpdateDateColumn,
     OneToOne,
} from 'typeorm';
import { UserRole, AccountStatus } from '../enums/user.enums';
import { Doctor } from '../../doctors/entities/doctor.entity';
import { Patient } from '../../patients/entities/patient.entity';

@Entity('users')
export class User {
     @PrimaryGeneratedColumn()
     user_id: number;

     @Column({ type: 'varchar', length: 100 })
     full_name: string;

     @Column({ type: 'varchar', unique: true })
     email: string;

     @Column({ type: 'varchar', nullable: true })
     password: string;

     @Column({ type: 'varchar', length: 15, nullable: true })
     phone: string;

     @Column({
          type: 'enum',
          enum: UserRole,
     })
     role: UserRole;

     @Column({
          type: 'enum',
          enum: AccountStatus,
          default: AccountStatus.ACTIVE,
     })
     account_status: AccountStatus;

     @Column({ type: 'varchar', nullable: true })
     profile_picture: string;

     @Column({ type: 'date', nullable: true })
     date_of_birth: Date;

     @Column({ type: 'varchar', nullable: true })
     gender: string;

     @CreateDateColumn()
     created_at: Date;

     @UpdateDateColumn()
     updated_at: Date;

     // Relations
     @OneToOne(() => Doctor, (doctor) => doctor.user)
     doctor: Doctor;

     @OneToOne(() => Patient, (patient) => patient.user)
     patient: Patient;

     // Computed properties
     get profile() {
          return {
               user_id: this.user_id,
               full_name: this.full_name,
               email: this.email,
               phone: this.phone,
               profile_picture: this.profile_picture,
               date_of_birth: this.date_of_birth,
               gender: this.gender,
          };
     }
}
