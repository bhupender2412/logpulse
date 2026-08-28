# PulseEngine

> A real-time asynchronous webhook delivery and monitoring platform built with TypeScript, Node.js, Redis, BullMQ, MongoDB Atlas, Socket.IO, and React.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-000000?style=flat-square&logo=vercel)](https://logpulse-3dgx.vercel.app/)
[![Backend API](https://img.shields.io/badge/Backend-Render-46E3B7?style=flat-square&logo=render)](https://pulseengine-api.onrender.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/)

**Live Application:** https://logpulse-3dgx.vercel.app/  
**Backend API:** https://pulseengine-api.onrender.com

## Overview

PulseEngine is a webhook delivery and monitoring platform designed to process outgoing webhook events asynchronously.

Instead of waiting for a third-party endpoint to respond inside the Express request lifecycle, the dispatch API validates the request, creates an event, pushes a job into a BullMQ queue backed by Redis, and immediately returns `202 Accepted`.

A separate worker process consumes queued jobs, signs outgoing payloads using HMAC SHA-256, sends the webhook request, records the result in MongoDB, and automatically retries failed deliveries using exponential backoff.

The React dashboard provides real-time visibility into delivery status, latency, failures, retries, payloads, responses, and execution history using Socket.IO.

## Features

- Asynchronous webhook delivery using BullMQ and Redis
- Automatic retries with exponential backoff
- HMAC SHA-256 webhook signing
- Timestamp-based replay protection
- Project API-key authentication
- Hashed API-key storage
- Redis API-key caching
- API-key rotation with cache invalidation
- Per-project Redis rate limiting
- JWT-based dashboard authentication
- User-isolated Socket.IO rooms
- Real-time webhook delivery updates
- Delivery success and failure analytics
- Latency monitoring
- Request payload and response inspection
- Complete delivery attempt history
- Manual redelivery of failed events
- Project management
- Endpoint management
- MongoDB Atlas persistence

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
- JWT
- Zod

### Infrastructure

- MongoDB Atlas
- Hosted Redis
- Render
- Vercel

## Architecture

```text
Client
  |
  | X-Pulse-API-Key
  v
Express Dispatch API
  |
  | POST /api/v1/dispatch
  |
  | 202 Accepted
  v
Redis / BullMQ
  |
  v
Webhook Worker
  |
  | HMAC SHA-256 Signing
  | HTTP Delivery
  | Retry / Backoff
  v
Target Webhook Endpoint
  |
  v
MongoDB Atlas


Webhook Worker
  |
  | Redis Pub/Sub
  v
Socket.IO Server
  |
  v
React Dashboard