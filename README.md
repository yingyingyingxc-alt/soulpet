# SoulPet

SoulPet is a React + Vite H5 demo with a Node.js API server. The demo flow is:

```text
Home -> Create SoulPet -> AI pet generation / character cutout -> Home -> feed, pet, life state, BGM
```

The browser always calls same-origin API endpoints:

```text
POST /api/generate-pet
POST /api/remove-character-background
GET /api/health
```

The Node server reads AI credentials from environment variables and serves the built Vite app from `dist` in production.

## Local Setup

```bash
npm install
cp .env.example .env
```

Set local environment variables in `.env`. Do not commit real secrets.

For Volcengine Ark:

```bash
IMAGE_AI_PROVIDER=volcengine
VOLCENGINE_API_KEY=
VOLCENGINE_IMAGE_MODEL=
SERVER_PORT=3001
```

Optional OpenAI fallback:

```bash
IMAGE_AI_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_IMAGE_MODEL=gpt-image-1.5
```

## Local Development

```bash
npm run dev
```

Client:

```text
http://localhost:5173
```

Server:

```text
http://localhost:3001
```

## Production-Like Local Demo

Build the Vite app and let the Node server host `dist`:

```bash
npm run demo
```

Open:

```text
http://localhost:3001
```

## Build

```bash
npm run build
```

Optional type check:

```bash
npm run typecheck
```

## Railway Deployment

1. Push this project to a GitHub repository.
2. Create a new Railway project.
3. Choose **Deploy from GitHub repo** and select the SoulPet repo.
4. Set Railway build command:

```bash
npm run build
```

5. Set Railway start command:

```bash
npm run start
```

6. Add Railway environment variables:

```text
IMAGE_AI_PROVIDER=volcengine
VOLCENGINE_API_KEY=<your Volcengine Ark API key>
VOLCENGINE_IMAGE_MODEL=<your Volcengine image model or endpoint id>
SERVER_PORT=3001
```

Railway also injects `PORT` automatically. The server uses:

```text
PORT -> SERVER_PORT -> 3001
```

7. Deploy. After Railway finishes, open the generated public domain.
8. Test:

```text
/api/health
/
/create
```

Then run the full demo flow in the browser.

## Static Files

Home BGM should be placed at:

```text
public/audio/soulpet-home.mp3
```

If the file is missing, the app should still load normally.

## Notes

- Do not commit `.env`.
- Keep frontend API calls as `/api/generate-pet` and `/api/remove-character-background`.
- Production is a single Node service: Express APIs plus `dist` static hosting.
- `app.get("*")` style fallback is implemented with an Express 5-compatible regular expression because Express 5 rejects the literal `"*"`.
