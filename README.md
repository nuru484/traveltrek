# 🌍 TravelTrek – Smart Travel & Tour Management Platform

**TravelTrek** is an all-in-one travel and tour management system built to streamline the **booking**, **planning**, and **management** of trips and tours.
Users can easily explore destinations, book flights, hotels, and tours — while admins and agents handle operations behind the scenes to ensure a smooth, automated travel experience.

---

## 📚 Table of Contents

* [Features](#-features)
* [Tech Stack](#-tech-stack)
* [Architecture Overview](#-architecture-overview)
* [Data Model](#-data-model)
* [Screenshots](#-screenshots)
* [Getting Started](#-getting-started)
* [Environment Variables](#-environment-variables)
* [Usage](#-usage)
* [Project Structure](#-project-structure)
* [Deployment](#-deployment)
* [Contributing](#-contributing)
* [License](#-license)

---

## ✨ Features

### 🧳 User Experience

* Explore available destinations, tours, flights, and hotels.
* Book multiple services in a single itinerary.
* Manage bookings, payments, and travel plans seamlessly.
* Real-time status updates for flights and tours.
* Upload documents and travel proofs securely via **Cloudinary**.

### 🛡️ Admin Capabilities

* Manage all system data including:

  * Flights ✈️
  * Hotels & Rooms 🏨
  * Tours & Destinations 🌐
* Handle bookings and payments for users.
* Oversee agent activities and booking performance.
* Full control of platform operations and content.

### 🤝 Agent Role

* Book flights, hotels, and tours on behalf of users.
* Process payments and manage customer bookings.
* Receive system updates and alerts about availability or schedule changes.

### ⚙️ Automated System Intelligence

Background workers run as a **separate process** (`worker.ts`) on **BullMQ + Redis**, with repeatable schedulers keeping the platform's data accurate without manual intervention:

* **Booking deadline worker** — cancels/flags bookings whose payment deadline has passed (handles same-day "immediate payment" bookings too).
* **Flight status worker** — auto-transitions flights through `SCHEDULED → DEPARTED → LANDED` (and `DELAYED`/`CANCELLED`) based on departure/arrival times.
* **Tour status worker** — auto-transitions tours through `UPCOMING → ONGOING → COMPLETED` based on their start/end dates.

### 🔐 Authentication & Security

* Cookie-based **JWT authentication**.
* Protected routes for users, admins, and agents.
* Validation powered by **Zod** (frontend) and **Express Validator** (backend).
* Secure file management via **Cloudinary**.

---

## 🛠️ Tech Stack

| Layer                | Technology                                                        |
| -------------------- | ----------------------------------------------------------------- |
| **Frontend**         | Next.js 16 (App Router) + React 19 (TypeScript)                   |
| **UI & Styling**     | TailwindCSS, shadcn/ui (Radix UI), next-themes, framer-motion     |
| **State Management** | Redux Toolkit + React-Redux                                       |
| **Data Tables**      | @tanstack/react-table                                             |
| **Forms & Validation** | react-hook-form + Zod (frontend), express-validator (backend)  |
| **Backend**          | Node.js, Express.js (TypeScript)                                  |
| **Database**         | PostgreSQL + Prisma ORM                                           |
| **Auth & Security**  | JWT (httpOnly cookies), bcrypt, express-rate-limit, CORS          |
| **File Storage**     | Cloudinary (uploads via multer)                                  |
| **Queue & Jobs**     | BullMQ + Redis (ioredis), p-map                                  |
| **Logging**          | pino + pino-pretty, morgan                                       |
| **Deployment**       | Render (Backend + Worker), Vercel (Frontend)                     |

---

## 🏗️ Architecture Overview

```
Customer / Agent / Admin Interface (Next.js 16 + Redux)
        │  REST (JWT in httpOnly cookies)
        ▼
REST API (Express.js + TypeScript)
        │
Prisma ORM ──► PostgreSQL          Cloudinary (media)
        │
BullMQ + Redis  ── separate worker process
   ├── booking deadline worker
   ├── flight status worker
   └── tour status worker
```

The HTTP API (`server.ts`) and the background **worker** (`worker.ts`) run as two processes against the same database, so scheduled status/booking updates never block API requests.

---

## 🗄️ Data Model

Three roles — **`ADMIN`**, **`AGENT`**, **`CUSTOMER`** — operate over a connected travel-inventory model:

* **Destination** — the hub entity (country/city) that tours, hotels, and flights belong to.
* **Tour** — typed (`ADVENTURE`, `CULTURAL`, `BEACH`, `CITY`, `WILDLIFE`, `CRUISE`) and status-tracked (`UPCOMING → ONGOING → COMPLETED`/`CANCELLED`), with pricing, duration, and guest capacity.
* **Hotel → Room** — hotels with star ratings and amenities, each offering rooms with per-night pricing, capacity, and inventory.
* **Flight** — airline, route (origin → destination), class, pricing, seat inventory, and live status (`SCHEDULED`, `DEPARTED`, `LANDED`, `DELAYED`, `CANCELLED`).
* **Booking** — a single record that can reference a **tour, room, or flight**, with guest counts, check-in/out dates, auto-calculated nights, a **payment deadline**, and status (`PENDING → CONFIRMED → COMPLETED`/`CANCELLED`).
* **Payment** — linked to a booking, with amount, currency (default **GHS**), method (`CREDIT_CARD`, `DEBIT_CARD`, `MOBILE_MONEY`, `BANK_TRANSFER`), status (`PENDING`, `COMPLETED`, `FAILED`, `REFUNDED`), and a unique transaction reference.

---

## 🖼️ Screenshots

| Section            | Image                                               |
| ------------------ | --------------------------------------------------- |
| User Dashboard     | ![User Dashboard](public/docs/user-dashboard.png)   |
| Admin Dashboard    | ![Admin Dashboard](public/docs/admin-dashboard.png) |
| Booking Management | ![Booking Management](public/docs/booking.png)      |

---

## 🚀 Getting Started

### Prerequisites

* **Node.js** >= 18
* **PostgreSQL** >= 14
* **Redis** (for BullMQ workers)

### Installation

```bash
# Clone the project
git clone git@github.com:your-username/traveltrek.git
cd traveltrek

# Install dependencies (includes both client & server)
npm install
```

### Database Setup

```bash
# Initialize database with Prisma
npm run migrate
```

> ⚙️ **Seed Default Admin User**
>
> After running the migration, you must seed the database to create the **default admin user**:
>
> ```bash
> npm run seed
> ```
>
> This step ensures the system has an initial admin account available for login and management.

### Running the Application

```bash
# Development mode (both client & server)
npm run dev

# Production mode
npm run build
npm start
```

Default URLs:
👉 [http://localhost:3000](http://localhost:3000) *(Frontend)*
👉 [http://localhost:8080](http://localhost:8080) *(Backend API)*

---

## 🔐 Environment Variables

Create `.env` files for **both** frontend and backend following the provided `env.example` files.
Ensure all API keys, database URLs, Cloudinary credentials, and the Redis connection are properly configured.

---

## ▶️ Usage

* **Users** browse destinations, book flights, hotels, and tours.
* **Agents** assist users with bookings and payments.
* **Admins** manage the platform’s entire ecosystem.
* **System** runs background workers (BullMQ + Redis) to auto-update booking, flight, and tour statuses and maintain data integrity.

---

## 📦 Project Structure

```
traveltrek/
│
├── frontend/        # Next.js 16 app (App Router)
│   ├── app/
│   ├── components/
│   └── redux/
│
├── backend/         # Express.js API + worker (TypeScript)
│   ├── prisma/      # Schema, migrations & seed
│   ├── src/
│   │   ├── controllers/  routes/  middlewares/  validations/
│   │   ├── jobs/         # BullMQ queues, workers & schedulers
│   │   ├── config/  utils/
│   ├── server.ts    # HTTP API entry point
│   └── worker.ts    # Background worker entry point
│
└── public/docs/     # Screenshots & docs
```

---

## 🌐 Deployment

Live Demo: [https://traveltrek.manuru.dev/](https://traveltrek.manuru.dev/)

Deployed using:

* **Frontend** – Vercel
* **Backend** – Render
* **Database** – Managed PostgreSQL
* **File Storage** – Cloudinary
* **Task Automation** – BullMQ + Redis (separate worker process)

---

## 🤝 Contributing

Contributions are welcome! If you'd like to improve this project, feel free to:

- **Fork** the repository
- **Create a feature branch** (`git checkout -b feature/amazing-feature`)
- **Commit your changes** (`git commit -m 'Add some amazing feature'`)
- **Push to the branch** (`git push origin feature/amazing-feature`)
- **Open a Pull Request**

Please ensure your code follows the project's style guidelines and includes appropriate tests where applicable.

For major changes, please open an issue first to discuss what you would like to change.

📩 Questions or suggestions?
**[abdulmajeednurudeen47@gmail.com](mailto:abdulmajeednurudeen47@gmail.com)**

---

## 🧾 License

**MIT License**

Copyright (c) 2025 Nurudeen Abdul-Majeed

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

