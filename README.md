# 🏥 Schedula - Doctor Appointment Booking System Backend

[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![JWT](https://img.shields.io/badge/JWT-000000?style=for-the-badge&logo=JSON%20web%20tokens&logoColor=white)](https://jwt.io/)

A comprehensive, enterprise-grade doctor appointment booking system backend built with **NestJS**, **TypeORM**, and **PostgreSQL**. Features advanced scheduling operations, JWT authentication, role-based access control, and flexible appointment management with **FCFS (First Come First Serve)** rescheduling logic.

## ✨ Key Features

### 🔐 **Authentication & Authorization**
- **JWT-based authentication** with refresh tokens
- **Role-based access control** (Doctor, Patient, Admin)
- **Secure password hashing** with bcrypt
- **Protected routes** with custom guards and decorators

### 📅 **Unified Scheduling System**
- **Single API Endpoint**: `/api/doctors/:doctorId/reschedule` for all scheduling operations
- **Three scheduling operations**:
  - **Slot-to-Slot Movement**: Move appointments between time slots
  - **Time Shift**: Bulk time adjustments for all appointments  
  - **Schedule Shrinking**: Reduce availability with automatic rescheduling
- **FCFS Rescheduling Logic**: Automatic appointment redistribution
- **Stream vs Wave Scheduling**: Flexible appointment scheduling modes
- **Simple parameter-based operations**: Direct time checking instead of complex enums
- **Real-time availability management**

### 👥 **User Management**
- **Multi-role user system** (Doctors, Patients)
- **Comprehensive profile management**
- **Doctor specialization and credentials**
- **Patient medical history tracking**

### 🗄️ **Database Architecture**
- **TypeORM integration** with PostgreSQL
- **Single migration** for complete schema setup
- **Optimized queries** with relations and indexing
- **Data validation** with class-validator
- **Clean migration history** with simplified structure

## 📁 Project Structure

```
Schedula_Binary-Bandits_Backend/
├── doctor-appointment-booking/          # Main NestJS Application
│   ├── src/
│   │   ├── auth/                       # 🔐 Authentication Module
│   │   │   ├── decorators/             # Custom decorators
│   │   │   │   ├── get-user.decorator.ts    # Extract user from JWT payload
│   │   │   │   ├── public.decorator.ts      # Mark routes as public
│   │   │   │   └── roles.decorator.ts       # Role-based access control
│   │   │   ├── dto/                    # Authentication DTOs
│   │   │   │   └── auth.dto.ts              # Login, registration DTOs
│   │   │   ├── entities/               # User entities
│   │   │   │   └── user.entity.ts           # Base user entity with profile getter
│   │   │   ├── enums/                  # Authentication enums
│   │   │   │   └── user.enums.ts            # UserRole, AccountStatus
│   │   │   ├── guards/                 # Security guards
│   │   │   │   ├── jwt-auth.guard.ts        # JWT token validation
│   │   │   │   └── roles.guard.ts           # Role-based route protection
│   │   │   ├── strategies/             # Passport strategies
│   │   │   │   └── jwt.strategy.ts          # JWT strategy with user validation
│   │   │   ├── auth.controller.ts      # Authentication endpoints
│   │   │   ├── auth.service.ts         # Authentication logic & JWT handling
│   │   │   └── auth.module.ts          # Auth module configuration
│   │   │
│   │   ├── doctors/                    # 👨‍⚕️ Doctor Management Module
│   │   │   ├── dto/                    # Doctor-related DTOs
│   │   │   │   ├── create-availability.dto.ts   # Doctor availability creation
│   │   │   │   ├── create-timeslot.dto.ts       # Individual timeslot creation
│   │   │   │   └── schedule-operations.dto.ts   # Unified scheduling operations DTO
│   │   │   ├── entities/               # Doctor entities
│   │   │   │   ├── doctor.entity.ts             # Doctor profile with specializations
│   │   │   │   ├── doctor-availability.entity.ts # Doctor availability windows
│   │   │   │   └── doctor-time-slot.entity.ts   # Individual appointment slots
│   │   │   ├── enums/                  # Doctor-related enums
│   │   │   │   ├── availability.enums.ts        # Availability statuses
│   │   │   │   └── schedule-type.enums.ts       # STREAM vs WAVE scheduling
│   │   │   ├── services/               # Business logic services
│   │   │   │   └── schedule.service.ts          # Advanced scheduling operations service
│   │   │   ├── doctor.controller.ts    # Doctor profile & basic operations
│   │   │   ├── doctor.service.ts       # Doctor business logic
│   │   │   └── doctor.module.ts        # Doctor module configuration
│   │   │
│   │   ├── patients/                   # 🏥 Patient Management Module
│   │   │   ├── entities/               # Patient entities
│   │   │   │   └── patient.entity.ts        # Patient profile entity
│   │   │   ├── patient.controller.ts   # Patient profile endpoints
│   │   │   ├── patient.service.ts      # Patient business logic
│   │   │   └── patient.module.ts       # Patient module configuration
│   │   │
│   │   ├── appointments/               # 📋 Appointment Management Module
│   │   │   ├── dto/                    # Appointment DTOs
│   │   │   │   ├── new-appointment.dto.ts       # New appointment creation
│   │   │   │   └── reschedule-appointment.dto.ts # Enhanced rescheduling
│   │   │   ├── entities/               # Appointment entities
│   │   │   │   └── appointment.entity.ts        # Core appointment entity
│   │   │   ├── enums/                  # Appointment enums
│   │   │   │   ├── appointment-status.enum.ts   # SCHEDULED, COMPLETED, CANCELLED
│   │   │   │   └── reschedule-type.enum.ts      # POSTPONE, PREPONE
│   │   │   ├── appointment.controller.ts # Appointment CRUD operations
│   │   │   ├── appointment.service.ts  # Appointment business logic
│   │   │   └── appointment.module.ts   # Appointment module configuration
│   │   │
│   │   ├── profile/                    # 👤 Universal Profile Module
│   │   │   └── profile.controller.ts   # Cross-role profile endpoints
│   │   │
│   │   ├── migrations/                 # 🗄️ Database Migrations
│   │   │   └── 1721158400000-CreateAppointmentSystem.ts # Complete schema creation
│   │   │
│   │   ├── app.controller.ts           # Root application controller
│   │   ├── app.module.ts               # Main application module
│   │   ├── app.service.ts              # Root application service
│   │   ├── data-source.ts              # TypeORM configuration
│   │   └── main.ts                     # Application bootstrap
│   │
│   ├── .env.example                    # 🔧 Environment Template
│   ├── .gitignore                      # 📝 Git Ignore Rules
│   ├── nest-cli.json                   # ⚙️ NestJS CLI Configuration
│   ├── package.json                    # 📋 Project Dependencies & Scripts
│   ├── tsconfig.json                   # 🔧 TypeScript Configuration
│   └── tsconfig.build.json             # 🔧 Build TypeScript Configuration
│
└── README.md                           # 📖 This Documentation
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **PostgreSQL** (v12 or higher) 
- **npm** or **yarn** package manager

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/PearlThoughtsInternship/Schedula_Binary-Bandits_Backend.git
   cd Schedula_Binary-Bandits_Backend/doctor-appointment-booking
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Configure your `.env` file:
   ```env
   # Database Configuration
   DB_HOST=localhost
   DB_PORT=5432
   DB_PGUSERNAME=your_postgres_username
   DB_PGPASSWORD=your_postgres_password
   DB_DATABASE=schedula_db
   
   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRES_IN=24h
   
   # Application Configuration
   NODE_ENV=development
   PORT=3000
   ```

4. **Set up the database:**
   ```bash
   # Create database
   createdb schedula_db
   
   # Run migrations
   npm run migration:run
   ```

5. **Start the application:**
   ```bash
   # Development mode with hot reload
   npm run start:dev
   
   # Production mode
   npm run start:prod
   ```

The application will be available at `http://localhost:3000`

## 🔧 Recent Improvements

### ✨ **Codebase Optimization (Latest Updates)**
- **Unified API Endpoint**: Single `/reschedule` endpoint for all scheduling operations
- **Simplified Shrinking Logic**: Direct parameter checking instead of complex enum-based logic
- **Clean Migration Structure**: Single comprehensive migration for complete schema setup
- **Removed Unused Code**: Eliminated redundant files, methods, and entities
- **Simple Comments**: Clear, concise comments throughout the codebase
- **Streamlined Architecture**: Reduced complexity while maintaining all functionality

### 🗑️ **Cleaned Up Files**
- Removed unused DTOs and entities
- Eliminated redundant migration files
- Simplified data source configuration
- Optimized package.json scripts
- Updated documentation to reflect current structure

## 🔌 API Endpoints

### 🔐 Authentication Endpoints
```http
POST   /api/auth/patient/register    # Patient registration
POST   /api/auth/doctor/register     # Doctor registration  
POST   /api/auth/login               # User login
POST   /api/auth/logout              # User logout
```

### 👨‍⚕️ Doctor Endpoints
```http
GET    /api/doctors                  # Get all doctors (public)
GET    /api/doctors/:id              # Get doctor profile (public)
PATCH  /api/doctors/:id              # Update doctor profile (auth)
GET    /api/doctors/:id/slots        # Get doctor time slots
POST   /api/doctors/:id/slots        # Create time slot (auth)
DELETE /api/doctors/:id/slots/:slotId # Delete time slot (auth)
POST   /api/doctors/availability     # Create availability (auth)
POST   /api/doctors/timeslot         # Create timeslot (auth)
POST   /api/doctors/:doctorId/reschedule # Unified scheduling operations (auth)
```

### 📅 Unified Scheduling Operations
```http
POST   /api/doctors/:doctorId/reschedule    # All scheduling operations in one endpoint
```

### 🏥 Patient Endpoints
```http
GET    /api/patients/:id             # Get patient profile
PATCH  /api/patients/:id             # Update patient profile (auth)
```

### 📋 Appointment Endpoints
```http
GET    /api/v1/appointments          # Get appointments (auth)
POST   /api/v1/appointments/new      # Book new appointment (auth)
PATCH  /api/v1/appointments/:id/cancel # Cancel appointment (auth)
PATCH  /api/v1/appointments/reschedule  # Reschedule appointment (auth)
```

### 👤 Profile Endpoints
```http
GET    /api/profile                  # Get user profile (auth)
```

## 📊 Unified Scheduling System

### 🔄 Single Endpoint for All Operations

The scheduling system now uses one unified endpoint that automatically determines the operation type based on the request body:

```http
POST /api/doctors/:doctorId/reschedule
```

#### 1. **Slot-to-Slot Movement**
```json
{
  "availability_id": 1,
  "scheduling_type": "slot_slot",
  "source_slot_id": 10,
  "target_slot_id": 15,
  "appointment_id": 5,
  "reason": "Patient requested different time"
}
```

#### 2. **Time Shift Operations**
```json
{
  "availability_id": 1,
  "scheduling_type": "time_shift",
  "new_start_time": "10:00",
  "new_end_time": "18:00",
  "shift_minutes": 30,
  "reason": "Doctor schedule change"
}
```

#### 3. **Schedule Shrinking with FCFS**
```json
{
  "availability_id": 1,
  "scheduling_type": "shrinking",
  "new_start_time": "09:00",
  "new_end_time": "17:00",
  "reason": "Reduced clinic hours"
}
```

### 🎯 Simplified Shrinking Logic
- **Direct parameter checking**: Checks `new_start_time` and `new_end_time` directly
- **Flexible shrinking**: Shrink from start, end, or both based on provided parameters
- **Clean implementation**: No complex enum-based logic
- **Clear comments**: Simple, easy-to-understand code structure

### 🎯 FCFS (First Come First Serve) Logic
- **Automatic rescheduling** when slots are removed or modified
- **Priority-based redistribution** based on original booking time
- **Multi-level hierarchy** maintenance during rescheduling
- **Patient notification** system for schedule changes

## 🏗️ Database Schema

### Core Entities
- **Users**: Base user authentication and profile
- **Doctors**: Medical professionals with specializations
- **Patients**: Patient profiles and medical history
- **Appointments**: Booking records with status tracking
- **Doctor Availability**: Available consultation windows
- **Doctor Time Slots**: Individual appointment slots

### Entity Relationships
```
User (1:1) → Doctor
User (1:1) → Patient
Doctor (1:N) → DoctorAvailability
DoctorAvailability (1:N) → DoctorTimeSlot
DoctorTimeSlot (1:N) → Appointment
Patient (1:N) → Appointment
```

### Simplified Migration Structure

The database now uses a single, comprehensive migration for the complete schema:

```bash
# Single migration creates entire schema
npm run migration:run

# Rollback (drops entire schema)
npm run migration:revert

# Generate new migration when entities change
npm run migration:generate ./src/migrations/YourMigrationName
```

### Migration Benefits
- **Single source of truth**: One migration creates complete schema
- **Faster setup**: New environments need only one migration
- **Clean history**: No obsolete or redundant migrations
- **Easy maintenance**: Single file to update for schema changes






