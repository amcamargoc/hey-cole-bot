import 'dotenv/config';
import { createOpencode } from '@opencode-ai/sdk';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!TELEGRAM_BOT_TOKEN) {
  console.error('Please set TELEGRAM_BOT_TOKEN');
  process.exit(1);
}

async function test() {
  console.log('Starting OpenCode server...');
  const { client, server } = await createOpencode({
    hostname: '127.0.0.1',
    port: 4096,
  });
  console.log('OpenCode server ready');

  const session = await client.session.create({
    body: { title: 'Test Session' },
  });
  console.log('Session created:', session.data.id);

  const result = await client.session.prompt({
    path: { id: session.data.id },
    body: { parts: [{ type: 'text', text: 'Say "Hello from OpenCode!" and nothing else.' }] },
  });

  console.log('\n--- Response ---');
  console.log(JSON.stringify(result.data, null, 2));

  const fullResponse = result.data?.parts
    ?.filter(part => part.type === 'text')
    ?.map(part => part.text)
    ?.join('') || '';

  console.log('\n--- Extracted Response ---');
  console.log(fullResponse);

  if (fullResponse.includes('Hello from OpenCode')) {
    console.log('\n✅ Test PASSED: Bot can communicate with OpenCode');
  } else {
    console.log('\n❌ Test FAILED: Unexpected response');
  }

  server.close();
  process.exit(0);
}

test().catch(console.error);
