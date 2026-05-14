import { createOpencode } from '@opencode-ai/sdk';

async function testOpenCodeConnection() {
  try {
    console.log('Testing OpenCode connection...');
    const result = await createOpencode({
      hostname: '127.0.0.1',
      port: 4096,
      provider: {
        default: {
          options: {
            timeout: false,
          },
        },
      },
    });
    
    console.log('Connection successful!');
    console.log('Client:', !!result.client);
    console.log('Server:', !!result.server);
    
    // Test a simple prompt
    if (result.client) {
      console.log('Testing prompt...');
      const session = await result.client.session.create({
        body: { title: 'Test Session' }
      });
      
      console.log('Session created:', session.data?.id);
      
      if (session.data?.id) {
        const promptResult = await result.client.session.prompt({
          path: { id: session.data.id },
          body: {
            parts: [{ type: 'text', text: 'Say hello!' }]
          }
        });
        
        console.log('Prompt result:', promptResult);
        
        // Clean up
        await result.client.session.delete({ path: { id: session.data.id } });
      }
    }
    
    return true;
  } catch (error) {
    console.error('Connection test failed:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return false;
  }
}

testOpenCodeConnection().then(success => {
  process.exit(success ? 0 : 1);
});