// The bot runs inside the API process via BotModule.
// This file is only for standalone development/testing.
//
// For production, the bot is mounted as a webhook handler
// inside the API's Fastify instance at /telegram/webhook.
//
// To test locally with polling:
//   1. Set BOT_TOKEN in your .env
//   2. Run: npx ts-node-dev src/main.ts

console.log('Bot runs inside the API process. Use `pnpm dev:api` to start.');
console.log('For standalone polling (dev only), implement a polling adapter here.');
