# TranscriptionMate Admin Portal

The admin portal is the control room for the public audit system. It lets you:

- save training notes through chat
- maintain known site profiles and fingerprints
- review feedback sent from the main TranscriptionMate app

## Local development

```bash
npm install
npm run dev
```

## Shared environment

Set the same Redis environment variables here and in the main site so both apps read and write the same training data:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Set `OPENAI_API_KEY` to enable live trainer chat responses.
