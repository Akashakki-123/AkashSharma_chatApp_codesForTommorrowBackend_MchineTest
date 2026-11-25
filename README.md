# Chat Backend

Backend API for 1:1 and group chat built with Node.js, TypeScript, Express, PostgreSQL (Prisma), and Firebase Firestore.

Users, chats, and chat memberships live in PostgreSQL. Messages, per-user read receipts, and last-seen tracking live in Firestore.

## Stack

- Node.js + TypeScript (ESM, `strict: true`)
- Express 5
- PostgreSQL + Prisma (`@prisma/client`)
- Firebase Firestore (`firebase-admin`)
- Auth & protection: JWT (`jsonwebtoken`), `bcryptjs`, `express-rate-limit`

## Folder Layout

- `app.ts` / `index.ts` - Express setup, rate limiter, DB startup, graceful shutdown
- `prisma/schema.prisma` - `User`, `Chat`, `ChatMember` tables
- `src/api/v1/config/` - Prisma client (`db.ts`) and Firestore setup (`firebase.ts`)
- `src/api/v1/routes/` - Auth, user, and chat route definitions
- `src/api/v1/controllers/` - Request parsing and response status mapping
- `src/api/v1/helpers/` - Business logic (`auth`, `user`, `chat`) and response helpers
- `src/api/v1/formatters/` - Input trimming/validation and output shaping
- `src/api/v1/middlewares/` - JWT auth, rate limiting, error & 404 handlers
- `src/api/v1/constants/` - Shared response and error messages

## Setup

1. Install packages:

```bash
npm install
```

2. Create `.env` from `.env.example` and fill in your Postgres `DATABASE_URL`, `JWT_SECRET`, and Firebase service account variables (`FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL` or `FIREBASE_SERVICE_ACCOUNT_PATH`).

```bash
cp .env.example .env
```

3. Generate Prisma client and run migrations:

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init_chat_backend
```

4. Start the server:

```bash
# dev watch mode
npm run dev

# production build
npm run build
npm start
```

Server runs on `http://localhost:8000` by default.

## Testing

Run the included end-to-end smoke test while the server is running:

```bash
node smoke-test.js
```

You can also import `postman_collection.json` into Postman. Signup and login requests automatically save `token`, `tokenB`, `userAId`, `userBId`, `chatId`, and `messageId`.

## Endpoints

Routes are mounted on both `/` and `/v1`. All user and chat routes expect `Authorization: Bearer <token>`.

### Health & Auth

- `GET /v1/health` - Checks PostgreSQL (`SELECT 1`) and Firebase config status
- `POST /auth/signup` - `{ fullName, email, phone, password }`
- `POST /auth/login` - `{ email, password }`

### Users

- `GET /users?page=1&limit=10&search=` - List active users
- `GET /users/:id` - Get single user
- `PATCH /users/:id` - Update profile (owner or admin)
- `DELETE /users/:id` - Soft delete user (owner or admin)

### Chat (1:1 & Messaging)

- `POST /chat/create` - Create or reuse 1:1 chat
  ```json
  { "userAId": "<uuid>", "userBId": "<uuid>" }
  ```
- `POST /chat/:chatId/message/send` - Store message in Firestore
  ```json
  { "senderId": "<uuid>", "text": "Hello" }
  ```
- `GET /chat/:chatId/messages?limit=50` - Fetch latest messages ordered by timestamp
- `POST /chat/:chatId/message/:messageId/read` - Update read receipt in Firestore
  ```json
  { "userId": "<uuid>" }
  ```
- `POST /chat/:chatId/lastseen` - Update last seen message per user in Firestore
  ```json
  { "userId": "<uuid>", "messageId": "<firestore_msg_id>" }
  ```
- `GET /user/:userId/chats` - List user chats with `memberIds` from Postgres

### Bonus (Group Chats & Message Edit/Delete)

- `POST /chat/group` - `{ "name": "Team", "memberIds": ["<uuid>"] }`
- `POST /chat/:chatId/members` - `{ "memberIds": ["<uuid>"] }`
- `DELETE /chat/:chatId/members/:memberId` - Remove member (creator or self)
- `PATCH /chat/:chatId/message/:messageId` - `{ "text": "Updated text" }` (sender only)
- `DELETE /chat/:chatId/message/:messageId` - Soft delete message (sender only)
