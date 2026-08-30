# PulseEngine

> A real-time asynchronous webhook delivery and monitoring platform built with TypeScript, Node.js, Redis, BullMQ, MongoDB Atlas, Socket.IO, and React.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-000000?style=flat-square&logo=vercel)](https://logpulse-3dgx.vercel.app/)
[![Backend API](https://img.shields.io/badge/Backend-Render-46E3B7?style=flat-square&logo=render)](https://pulseengine-api.onrender.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/)

**Live Application:**  
https://logpulse-3dgx.vercel.app/

**Backend API:**  
https://pulseengine-api.onrender.com

**Repository:**  
https://github.com/bhupender2412/logpulse

---

## Overview

PulseEngine is a real-time webhook delivery and monitoring platform designed to process outgoing webhook events asynchronously and reliably.

Instead of waiting for a third-party webhook endpoint to respond inside the Express request lifecycle, the dispatch API validates the request, creates a webhook event, pushes a delivery job into a BullMQ queue backed by Redis, and immediately returns `202 Accepted`.

A dedicated webhook worker consumes queued jobs, signs outgoing payloads using HMAC SHA-256, performs the HTTP delivery, records every attempt in MongoDB, and automatically retries failed requests according to the configured retry policy.

Redis Pub/Sub is used to publish delivery lifecycle events from the worker to the API process. Socket.IO then forwards those events to authenticated users in real time.

The React dashboard provides visibility into delivery status, latency, failures, retries, request payloads, responses, attempt history, projects, endpoints, and analytics.

---

## Live Demo

PulseEngine includes a dedicated read-only demo environment intended for recruiters, interviewers, and developers who want to explore the platform without creating an account.

Open:

https://logpulse-3dgx.vercel.app/

Then select:

```text
Try Live Demo
```

The demo account automatically opens a preloaded environment containing:

- Multiple webhook projects
- Configured webhook endpoints
- Successful webhook deliveries
- Failed webhook deliveries
- Retry history
- Manual redelivery history
- HTTP response information
- Request payload inspection
- Delivery latency metrics
- Dashboard analytics
- Time-series delivery statistics

The demo account is intentionally read-only.

The following administrative operations are disabled:

- Project creation
- Project deletion
- Project API-key rotation
- Endpoint creation
- Endpoint editing
- Endpoint activation changes
- Endpoint deletion
- Manual webhook redelivery

These restrictions are enforced on both the frontend and backend.

Backend authorization remains the security boundary, so restricted API operations return `403 Forbidden` even if they are called directly outside the React interface.

---

## Features

### Webhook Delivery

- Asynchronous webhook delivery
- BullMQ-based background job processing
- Redis-backed delivery queue
- Automatic retry handling
- Configurable retry limits
- Exponential backoff
- Delivery attempt tracking
- Manual redelivery of failed webhook events
- HTTP response status tracking
- Delivery latency monitoring

### Security

- JWT-based dashboard authentication
- Role-based access control
- Read-only demo account
- Project API-key authentication
- Hashed API-key storage
- API-key rotation
- Redis API-key caching
- API-key cache invalidation
- HMAC SHA-256 webhook signing
- Timestamp-based replay protection
- Per-project Redis rate limiting
- User-isolated Socket.IO rooms

### Real-Time Monitoring

- Socket.IO delivery updates
- Redis Pub/Sub worker-to-API communication
- User-isolated real-time event streams
- Live delivery state changes
- Processing notifications
- Success notifications
- Failure notifications

### Dashboard

- Delivery overview
- Success and failure statistics
- Delivery success rate
- Failure rate
- Average latency
- Time-series analytics
- Project filtering
- Endpoint filtering
- Status filtering
- Event pagination
- Payload inspection
- Response inspection
- Delivery attempt history
- Redelivery history
- Project management
- Endpoint management

---

## Tech Stack

### Frontend

- React
- TypeScript
- Tailwind CSS
- Recharts
- Socket.IO Client
- Vite

### Backend

- Node.js
- Express
- TypeScript
- BullMQ
- Redis
- Socket.IO
- MongoDB
- Mongoose
- JSON Web Tokens
- Zod
- bcryptjs

### Infrastructure

- MongoDB Atlas
- Hosted Redis
- Render
- Vercel
- GitHub

---

## Architecture

```text
                    Client / Service
                           |
                           |
                    X-Pulse-API-Key
                           |
                           v
                +---------------------+
                | Express Dispatch API|
                | POST /api/v1/dispatch
                +---------------------+
                           |
                           |
                     202 Accepted
                           |
                           v
                +---------------------+
                |   Redis / BullMQ    |
                |  webhook-delivery   |
                +---------------------+
                           |
                           v
                +---------------------+
                |   Webhook Worker    |
                +---------------------+
                           |
                 HMAC SHA-256 Signing
                           |
                     HTTP Delivery
                           |
                   Retry / Backoff
                           |
                           v
                +---------------------+
                | Target Webhook URL  |
                +---------------------+
                           |
                           v
                    MongoDB Atlas
                 Delivery Persistence


                Webhook Worker
                       |
                       |
                 Redis Pub/Sub
                       |
                       v
                Socket.IO Server
                       |
                Authenticated
                  User Room
                       |
                       v
                 React Dashboard
```

---

## Webhook Delivery Flow

A normal webhook delivery follows this sequence:

```text
1. Client sends dispatch request
             |
             v
2. Project API key is validated
             |
             v
3. Rate limit is checked
             |
             v
4. Webhook event is stored
             |
             v
5. BullMQ job is created
             |
             v
6. API returns 202 Accepted
             |
             v
7. Worker consumes the job
             |
             v
8. HMAC signature is generated
             |
             v
9. HTTP request is sent
             |
             v
10. Delivery result is stored
             |
             v
11. Realtime event is published
             |
             v
12. Dashboard updates through Socket.IO
```

---

## Retry Flow

When a webhook delivery fails, BullMQ retries the request according to the endpoint retry configuration.

Example:

```text
Attempt 1
HTTP 503
Failed
    |
    v
Exponential Backoff
    |
    v
Attempt 2
HTTP 503
Failed
    |
    v
Exponential Backoff
    |
    v
Attempt 3
HTTP 200
Success
```

Each delivery attempt is stored individually in MongoDB.

The dashboard can therefore display the complete lifecycle of a webhook instead of only its final status.

---

## Webhook Dispatch API

### Endpoint

```http
POST /api/v1/dispatch
```

### Headers

```http
Content-Type: application/json
X-Pulse-API-Key: <project-api-key>
```

### Request

```json
{
  "endpointId": "ep_example",
  "payload": {
    "event": "payment.completed",
    "orderId": "ORD-1001",
    "amount": 2499,
    "currency": "INR"
  }
}
```

### Response

A successfully accepted webhook returns:

```http
202 Accepted
```

Example:

```json
{
  "success": true,
  "eventId": "evt_example",
  "jobId": "evt_example",
  "projectId": "payment-service",
  "endpointId": "ep_example",
  "status": "queued",
  "message": "Webhook accepted for delivery"
}
```

The webhook is processed asynchronously after this response.

---

## HMAC Webhook Signing

Outgoing webhook requests are signed using HMAC SHA-256.

The worker generates a signature using the endpoint signing secret.

Conceptually:

```text
timestamp + "." + requestBody
            |
            v
       HMAC SHA-256
            |
            v
     Webhook Signature
```

The receiving endpoint can verify the signature before accepting the webhook.

PulseEngine also includes timestamp-based replay protection so previously captured signed webhook requests cannot be replayed indefinitely.

---

## Authentication

PulseEngine uses two different authentication mechanisms.

### Dashboard Authentication

Dashboard users authenticate using JWT.

```text
Email + Password
       |
       v
Authentication API
       |
       v
JWT
       |
       v
Protected Dashboard APIs
```

### Project Authentication

External services dispatching webhooks authenticate using project API keys.

```http
X-Pulse-API-Key: <project-api-key>
```

API keys are not stored in plaintext.

PulseEngine stores only a SHA-256 hash and the final four characters required for identification in the dashboard.

---

## Role-Based Access Control

PulseEngine currently supports two dashboard roles:

```text
admin
demo
```

### Admin

Administrators can:

- Create projects
- Delete projects
- Rotate API keys
- Create endpoints
- Edit endpoints
- Enable or disable endpoints
- Delete endpoints
- Inspect webhook events
- Manually redeliver failed events
- View analytics

### Demo

Demo users can:

- View demo projects
- View endpoints
- View delivery events
- Inspect payloads
- Inspect responses
- View attempt history
- View redelivery history
- View dashboard statistics
- View time-series analytics

Administrative write operations are blocked.

---

## Real-Time Event Isolation

Socket.IO connections are authenticated using JWT.

Each authenticated user joins a dedicated room:

```text
user:<userId>
```

Webhook lifecycle events are only emitted to the owner of the corresponding webhook data.

This prevents delivery events belonging to one user from appearing in another user's dashboard.

---

## Project API Keys

Each project receives its own API key when created.

Example format:

```text
lp_live_xxxxxxxxxxxxxxxxx
```

The raw API key is returned only when the project is created or when the key is rotated.

MongoDB stores only:

```text
apiKeyHash
apiKeyLast4
```

Redis is used to cache validated API-key lookups and reduce repeated database queries.

When an API key is rotated, the previous Redis cache entry is invalidated immediately.

---

## Endpoint Configuration

Each webhook endpoint contains:

```text
Endpoint ID
Name
Project ID
Target URL
HTTP Method
Maximum Retries
HMAC Signing Secret
Active Status
Owner
```

Supported delivery methods:

```text
POST
PUT
PATCH
```

Each endpoint can configure its own retry policy.

---

## Delivery Event Model

Each webhook event stores:

```text
Event ID
Project ID
Endpoint ID
Owner
Payload
Status
Attempt Count
Attempt History
HTTP Response Status
Response Body
Latency
Error
Queue Timestamp
Processing Timestamp
Completion Timestamp
Redelivery Source
```

Supported delivery statuses:

```text
queued
processing
retrying
success
failed
```

---

## Analytics

The dashboard exposes delivery statistics including:

- Total deliveries
- Successful deliveries
- Failed deliveries
- Queued deliveries
- Processing deliveries
- Retrying deliveries
- Success rate
- Failure rate
- Average latency

Supported time ranges include:

```text
1 hour
6 hours
24 hours
7 days
30 days
all time
```

The backend generates zero-filled time-series buckets so charts remain consistent even when no events occurred during a specific interval.

---

## Main API Routes

### Health

```http
GET /api/health
```

### Authentication

```http
POST /api/v1/auth/login
```

### Current User

```http
GET /api/v1/users/me
```

### Projects

```http
GET    /api/v1/projects
POST   /api/v1/projects
POST   /api/v1/projects/:projectId/rotate-key
DELETE /api/v1/projects/:projectId
```

### Endpoints

```http
GET    /api/v1/endpoints
GET    /api/v1/endpoints/:endpointId
POST   /api/v1/endpoints
PATCH  /api/v1/endpoints/:endpointId
DELETE /api/v1/endpoints/:endpointId
```

### Webhook Events

```http
GET  /api/v1/events
GET  /api/v1/events/stats
GET  /api/v1/events/timeseries
GET  /api/v1/events/:eventId
GET  /api/v1/events/:eventId/redeliveries
POST /api/v1/events/:eventId/redeliver
```

### Webhook Dispatch

```http
POST /api/v1/dispatch
```

---

## Local Development

### Clone the Repository

```bash
git clone git@github.com:bhupender2412/logpulse.git

cd logpulse
```

---

### Backend Setup

```bash
cd backend

npm install
```

Create:

```text
backend/.env
```

using:

```text
backend/.env.example
```

Configure your own:

```text
MongoDB connection
Redis connection
JWT secret
CORS origin
Application configuration
```

Build the backend:

```bash
npm run build
```

Start the API:

```bash
npm run dev:server
```

---

### Start the Webhook Worker

Open another terminal:

```bash
cd backend

npm run dev:worker
```

The API and worker should both be running for full webhook delivery functionality.

---

### Frontend Setup

Open another terminal:

```bash
cd frontend

npm install

npm run dev
```

The development frontend is available by default at:

```text
http://localhost:5173
```

---

## Production Build

### Backend

```bash
cd backend

npm run build

npm start
```

### Frontend

```bash
cd frontend

npm run build
```

The production frontend output is generated inside:

```text
frontend/dist
```

---

## Deployment

| Component | Platform |
|---|---|
| Frontend | Vercel |
| Backend API | Render |
| Webhook Worker | Render |
| Database | MongoDB Atlas |
| Queue / Cache | Hosted Redis |

For the current portfolio deployment, the API and webhook worker run as two Node.js processes inside the same Render service.

The Render service starts both processes using:

```text
API
node dist/server.js

WORKER
node dist/workers/webhookWorker.js
```

This allows the portfolio deployment to demonstrate the complete asynchronous delivery architecture without requiring a separate paid Render background-worker service.

---

## Production Links

### Live Application

https://logpulse-3dgx.vercel.app/

### Backend API

https://pulseengine-api.onrender.com

### Health Check

https://pulseengine-api.onrender.com/api/health

### GitHub Repository

https://github.com/bhupender2412/logpulse

---

## Demo Data

The read-only demo environment contains representative webhook delivery scenarios including:

```text
payment.completed
invoice.generated
payment.refund.created
payment.failed
user.login
password.reset
security.alert
user.registered
subscription.renewed
```

The data includes examples of:

- Successful first-attempt deliveries
- Failed deliveries
- Multiple retry attempts
- Recovery after retry
- Final failure after all attempts
- Manual redelivery history
- Different HTTP response codes
- Different latency measurements

This allows the dashboard and monitoring features to be evaluated without modifying production configuration.

---

## Security Notes

Secrets and production credentials are not committed to the repository.

Environment-specific configuration is stored in `.env` files, while `.env.example` documents the required environment variables.

The application uses multiple security layers:

```text
JWT authentication
        |
        v
Role-based authorization
        |
        v
Project ownership isolation
        |
        v
Hashed API keys
        |
        v
Redis rate limiting
        |
        v
HMAC webhook signatures
        |
        v
Timestamp replay protection
        |
        v
Socket.IO user isolation
```

Frontend restrictions improve the user experience, while backend authorization remains responsible for enforcing access control.

---

## Author

Bhupender Singh