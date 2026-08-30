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

Instead of waiting for a target webhook endpoint to respond inside the Express request lifecycle, the dispatch API authenticates the project, validates the request, creates an event, queues a BullMQ job in Redis, and immediately returns `202 Accepted`.

A separate webhook worker consumes queued jobs, signs outgoing payloads using HMAC SHA-256, performs HTTP delivery, records every delivery attempt in MongoDB, and automatically retries failed deliveries using the configured retry policy.

Redis Pub/Sub is used to communicate webhook lifecycle changes between the worker and API server. Socket.IO then sends those updates to authenticated dashboard users in real time.

The React dashboard provides visibility into delivery status, latency, retries, failures, payloads, responses, attempt history, projects, endpoints, and delivery analytics.

---

## Live Demo

PulseEngine includes a dedicated read-only demo environment for recruiters, interviewers, and developers who want to explore the application without modifying production configuration.

Open:

https://logpulse-3dgx.vercel.app/

Then click:

```text
Try Live Demo
```

The demo environment contains preloaded:

- Projects
- Webhook endpoints
- Successful deliveries
- Failed deliveries
- Retry scenarios
- Manual redelivery history
- Request payloads
- Response bodies
- Delivery latency information
- Time-series analytics

The demo account is read-only.

Administrative operations such as project creation, API-key rotation, endpoint modification, deletion, and manual webhook redelivery are restricted.

These restrictions are enforced by backend role-based authorization even if a user attempts to call the protected APIs directly.

---

# Application Walkthrough

## 1. Dashboard

The PulseEngine dashboard provides a high-level view of webhook delivery activity.

It displays:

- Total webhook deliveries
- Successful deliveries
- Failed deliveries
- Success rate
- Failure rate
- Average latency
- Delivery activity over time
- Project filtering
- Endpoint filtering
- Status filtering
- Recent webhook events
- Real-time Socket.IO connection status

The dashboard is updated as webhook lifecycle events are processed.

![PulseEngine Dashboard](./screenshots/dashboard.png)

---

## 2. Project Management

Projects isolate webhook traffic between different applications and services.

Each project receives a dedicated API key which is used to authenticate webhook dispatch requests.

PulseEngine supports:

- Project creation
- Unique project identifiers
- Project API-key generation
- SHA-256 API-key hashing
- API-key last-four identification
- API-key rotation
- Redis API-key cache invalidation
- Project deletion
- User ownership isolation

The complete plaintext API key is shown only when it is generated or rotated.

Demo users can inspect projects but cannot create, rotate, or delete them.

![PulseEngine Project Management](./screenshots/projects.png)

---

## 3. Endpoint Configuration

Webhook endpoints define where PulseEngine should deliver events.

Each endpoint contains:

- Endpoint ID
- Friendly name
- Associated project
- Target webhook URL
- HTTP method
- Maximum retry count
- HMAC signing secret
- Active/disabled status
- Owner

Supported HTTP methods include:

```text
POST
PUT
PATCH
```

Administrators can create, edit, enable, disable, and delete webhook endpoints.

Demo users receive read-only access to endpoint configuration.

![PulseEngine Endpoint Configuration](./screenshots/endpoints.png)

---

## 4. Event Details

Every webhook event can be inspected using the Payload Inspector.

The event details view includes:

- Event ID
- Project ID
- Endpoint ID
- Delivery status
- HTTP response status
- Delivery latency
- Attempt count
- Request payload
- Response body
- Delivery errors
- Creation timestamp
- Completion timestamp
- Delivery attempt history
- Manual redelivery history

The event inspector provides a complete audit trail of each webhook delivery.

### Event Summary and Payload

![Webhook Event Details - Summary](./screenshots/event-details-1.png)

### Delivery Attempts and Additional Details

![Webhook Event Details - Attempts](./screenshots/event-details-2.png)

---

## 5. Failed Delivery and Retry Handling

PulseEngine automatically retries failed webhook deliveries according to the endpoint retry configuration.

Each attempt is stored independently with:

- Attempt number
- Attempt status
- HTTP status code
- Request latency
- Response body
- Error message
- Attempt timestamp

A failed delivery may follow a flow similar to:

```text
Attempt 1
HTTP 500
Failed
    |
    v
Backoff
    |
    v
Attempt 2
HTTP 500
Failed
    |
    v
Backoff
    |
    v
Attempt 3
HTTP 503
Failed
```

Another webhook may recover during a later attempt:

```text
Attempt 1
HTTP 503
Failed
    |
    v
Retry
    |
    v
Attempt 2
HTTP 200
Success
```

Administrators can manually redeliver webhook events that remain failed after automatic retries.

Manual redelivery creates a new event linked to the original event through the `redeliveryOf` field. This preserves the original delivery history instead of overwriting it.

Manual redelivery is disabled for the read-only demo account.

### Failed Event Summary

![Failed Webhook Delivery - Summary](./screenshots/failed-delivery-1.png)

### Delivery Attempt History

![Failed Webhook Delivery - Attempts](./screenshots/failed-delivery-2.png)

### Error and Redelivery Information

![Failed Webhook Delivery - Redelivery](./screenshots/failed-delivery-3.png)

---

## 6. Real-Time Updates

Webhook processing takes place asynchronously in the worker process.

As the worker processes an event, it publishes lifecycle information through Redis Pub/Sub.

The API server receives those messages and forwards them to authenticated clients through Socket.IO.

```text
Webhook Dispatch
       |
       v
BullMQ Queue
       |
       v
Webhook Worker
       |
       v
Redis Pub/Sub
       |
       v
Socket.IO Server
       |
       v
Authenticated User Room
       |
       v
React Dashboard
```

Realtime lifecycle events include states such as:

```text
processing
retrying
success
failed
```

Socket.IO connections are authenticated using JWT.

Each connected dashboard user joins an isolated room:

```text
user:<userId>
```

This ensures webhook updates are delivered only to the user who owns the corresponding project and event.

The screenshot below shows a production webhook event appearing on the dashboard through the real-time delivery pipeline.

![PulseEngine Real-Time Webhook Update](./screenshots/realtime-update.png)

---

# Features

## Webhook Delivery

- Asynchronous webhook processing
- BullMQ job queue
- Redis-backed queue
- Dedicated worker process
- Configurable retry policies
- Automatic retries
- Exponential backoff
- Complete attempt history
- Manual redelivery
- HTTP status tracking
- Response-body storage
- Latency monitoring

## Security

- JWT dashboard authentication
- Role-based authorization
- Admin and demo roles
- Read-only demo mode
- Project API-key authentication
- SHA-256 API-key hashing
- API-key rotation
- Redis API-key caching
- API-key cache invalidation
- HMAC SHA-256 webhook signing
- Timestamp-based replay protection
- Per-project Redis rate limiting
- User-isolated Socket.IO rooms

## Monitoring

- Real-time webhook updates
- Delivery status analytics
- Success-rate calculation
- Failure-rate calculation
- Average latency
- Time-series charts
- Project filters
- Endpoint filters
- Status filters
- Event pagination
- Payload inspection
- Response inspection
- Attempt history
- Redelivery history

---

# Tech Stack

## Frontend

- React
- TypeScript
- Tailwind CSS
- Recharts
- Socket.IO Client
- Vite

## Backend

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

## Infrastructure

- MongoDB Atlas
- Hosted Redis
- Render
- Vercel
- GitHub

---

# Architecture

```text
                    Client / Service
                           |
                           |
                    X-Pulse-API-Key
                           |
                           v
                +---------------------+
                | Express Dispatch API|
                +---------------------+
                           |
                  POST /api/v1/dispatch
                           |
                           v
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
                         v
                    Redis Pub/Sub
                         |
                         v
                   Socket.IO Server
                         |
                         v
                Authenticated User Room
                         |
                         v
                   React Dashboard
```

---

# Webhook Delivery Flow

A normal webhook delivery follows this sequence:

```text
Client
  |
  v
Dispatch API
  |
  | Validate API Key
  | Apply Rate Limit
  | Validate Endpoint
  |
  v
Create Webhook Event
  |
  v
Add BullMQ Job
  |
  v
202 Accepted
  |
  v
Webhook Worker
  |
  | Generate HMAC Signature
  |
  v
Target Endpoint
  |
  v
Store Delivery Result
  |
  v
Redis Pub/Sub
  |
  v
Socket.IO
  |
  v
Dashboard Update
```

---

# Webhook Dispatch API

## Endpoint

```http
POST /api/v1/dispatch
```

## Required Headers

```http
Content-Type: application/json
X-Pulse-API-Key: <project-api-key>
```

## Example Request

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

A valid request is accepted asynchronously:

```http
202 Accepted
```

Example response:

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

---

# HMAC Webhook Signing

PulseEngine signs outgoing webhook requests using HMAC SHA-256.

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

The receiving endpoint can use its signing secret to independently verify that the webhook originated from PulseEngine.

Timestamp validation is also used to protect receiving endpoints from replay attacks.

---

# Authentication

PulseEngine uses separate authentication mechanisms for dashboard users and webhook-producing services.

## Dashboard Authentication

Dashboard users authenticate using email and password.

After successful authentication, the backend returns a JWT.

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

## Project Authentication

External services authenticate webhook dispatch requests using:

```http
X-Pulse-API-Key: <project-api-key>
```

The complete project API key is not stored in plaintext.

MongoDB stores:

```text
apiKeyHash
apiKeyLast4
```

---

# Role-Based Access Control

PulseEngine currently supports:

```text
admin
demo
```

## Admin Role

Administrators can:

- View analytics
- Inspect webhook events
- Create projects
- Rotate project API keys
- Delete projects
- Create endpoints
- Edit endpoints
- Enable or disable endpoints
- Delete endpoints
- Manually redeliver failed webhook events

## Demo Role

Demo users can:

- View dashboard analytics
- View projects
- View endpoint configuration
- View webhook events
- Inspect request payloads
- Inspect responses
- View attempt history
- View redelivery history
- View time-series analytics

Demo users cannot perform administrative write operations.

Backend middleware enforces these restrictions and returns:

```http
403 Forbidden
```

for restricted operations.

---

# Project API-Key Security

Each project receives an API key when it is created.

Example:

```text
lp_live_xxxxxxxxxxxxxxxxxxxxx
```

The raw key is returned only when:

```text
Project created
or
API key rotated
```

PulseEngine stores only its SHA-256 hash.

Redis caches validated project API keys to reduce repeated database lookups.

When a key is rotated:

```text
Generate New Key
      |
      v
Store New Hash
      |
      v
Invalidate Previous Redis Entry
      |
      v
Old API Key Stops Working
```

---

# Endpoint Configuration

Each endpoint stores:

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

Supported HTTP methods:

```text
POST
PUT
PATCH
```

Each endpoint can configure its own retry policy.

---

# Webhook Event Model

Each webhook delivery records:

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
Queued Timestamp
Processing Timestamp
Completion Timestamp
Redelivery Source
```

Supported statuses:

```text
queued
processing
retrying
success
failed
```

---

# Analytics

PulseEngine calculates:

- Total webhook deliveries
- Successful deliveries
- Failed deliveries
- Queued deliveries
- Processing deliveries
- Retrying deliveries
- Success rate
- Failure rate
- Average latency

Supported analytics ranges include:

```text
1 hour
6 hours
24 hours
7 days
30 days
all time
```

The backend produces zero-filled time-series buckets so dashboard charts remain continuous even when no event occurred during a particular interval.

---

# Main API Routes

## Health

```http
GET /api/health
```

## Authentication

```http
POST /api/v1/auth/login
```

## Current User

```http
GET /api/v1/users/me
```

## Projects

```http
GET    /api/v1/projects
POST   /api/v1/projects
POST   /api/v1/projects/:projectId/rotate-key
DELETE /api/v1/projects/:projectId
```

## Endpoints

```http
GET    /api/v1/endpoints
GET    /api/v1/endpoints/:endpointId
POST   /api/v1/endpoints
PATCH  /api/v1/endpoints/:endpointId
DELETE /api/v1/endpoints/:endpointId
```

## Webhook Events

```http
GET  /api/v1/events
GET  /api/v1/events/stats
GET  /api/v1/events/timeseries
GET  /api/v1/events/:eventId
GET  /api/v1/events/:eventId/redeliveries
POST /api/v1/events/:eventId/redeliver
```

## Dispatch

```http
POST /api/v1/dispatch
```

---

# Local Development

## Clone the Repository

```bash
git clone git@github.com:bhupender2412/logpulse.git

cd logpulse
```

## Backend Setup

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

Provide your own configuration for:

```text
MongoDB
Redis
JWT
CORS
Application environment
```

Build:

```bash
npm run build
```

Start the API:

```bash
npm run dev:server
```

---

## Start the Webhook Worker

Open another terminal:

```bash
cd backend

npm run dev:worker
```

The API and worker must both be running to test the complete asynchronous delivery pipeline locally.

---

## Frontend Setup

Open another terminal:

```bash
cd frontend

npm install

npm run dev
```

The development frontend runs at:

```text
http://localhost:5173
```

---

# Production Build

## Backend

```bash
cd backend

npm run build
```

Run the production API:

```bash
npm start
```

Run the production worker:

```bash
npm run start:worker
```

## Frontend

```bash
cd frontend

npm run build
```

The production frontend is generated in:

```text
frontend/dist
```

---

# Deployment

| Component | Platform |
|---|---|
| Frontend | Vercel |
| Backend API | Render |
| Webhook Worker | Render |
| Database | MongoDB Atlas |
| Queue / Cache | Hosted Redis |

For the current portfolio deployment, the API server and webhook worker run as separate Node.js processes inside the same Render web service.

The Render service starts both processes using the application's `start:render` script.

Conceptually:

```text
Render Service
     |
     +----------------------+
     |                      |
     v                      v
API Process            Worker Process
     |                      |
     +----------+-----------+
                |
                v
              Redis
                |
                v
          MongoDB Atlas
```

This allows the complete asynchronous delivery architecture to run without requiring a separate paid background-worker instance for the portfolio deployment.

---

# Production Links

## Live Application

https://logpulse-3dgx.vercel.app/

## Backend API

https://pulseengine-api.onrender.com

## Health Check

https://pulseengine-api.onrender.com/api/health

## GitHub Repository

https://github.com/bhupender2412/logpulse

---

# Demo Data

The read-only demo environment contains representative events including:

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

These events demonstrate:

- First-attempt success
- Failed delivery
- Multiple retry attempts
- Retry recovery
- Final delivery failure
- Manual redelivery history
- Different HTTP response codes
- Different latency values
- Request and response inspection

---

# Security Notes

Production secrets and credentials are not committed to the repository.

Environment-specific values are stored in `.env` files while `.env.example` documents the required variables.

PulseEngine applies multiple security layers:

```text
JWT Authentication
        |
        v
Role-Based Authorization
        |
        v
Project Ownership Isolation
        |
        v
Hashed Project API Keys
        |
        v
Redis Rate Limiting
        |
        v
HMAC Webhook Signing
        |
        v
Timestamp Replay Protection
        |
        v
Socket.IO User Isolation
```

Frontend restrictions provide a better user experience, but backend authorization remains the security boundary.

---

# Author

Bhupender Singh