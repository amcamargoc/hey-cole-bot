import { createOpencode } from '@opencode-ai/sdk';

async function debugPromptResult() {
  try {
    console.log('Debugging OpenCode prompt result structure...');
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
    
    if (!result.client) {
      console.log('No client available');
      return false;
    }
    
    // Create a session
    const session = await result.client.session.create({
      body: { title: 'Debug Session' }
    });
    
    console.log('Session created:', session.data?.id);
    
    if (!session.data?.id) {
      console.log('Failed to create session');
      return false;
    }
    
    // Send a prompt and examine the result structure
    const promptResult = await result.client.session.prompt({
      path: { id: session.data.id },
      body: {
        parts: [{ type: 'text', text: 'Hello, how are you?' }]
      }
    });
    
    console.log('=== PROMPT RESULT STRUCTURE ===');
    console.log('JSON:', JSON.stringify(promptResult, null, 2));
    
    console.log('\n=== PARTS ANALYSIS ===');
    if (promptResult.data && promptResult.data.parts) {
      promptResult.data.parts.forEach((part, index) => {
        console.log(`Part ${index}:`, JSON.stringify(part, null, 2));
        console.log(`  Type: ${typeof part}`);
        console.log(`  Has type property: ${part.hasOwnProperty('type')}`);
        if (part.type) {
          console.log(`  Type value: ${part.type}`);
        }
        console.log(`  Has text property: ${part.hasOwnProperty('text')}`);
        if (part.text) {
          console.log(`  Text value: ${part.text}`);
        }
        console.log('---');
      });
    }
    
    // Test the current logic from llmService.js
    console.log('\n=== TESTING CURRENT LOGIC ===');
    const filteredParts = promptResult.data?.parts?.filter(part => part.type === 'text');
    console.log('Filtered parts (type === "text"):', filteredParts);
    
    if (filteredParts) {
      const mappedText = filteredParts.map(part => part.text);
      console.log('Mapped text:', mappedText);
      
      const joinedText = mappedText.join('');
      console.log('Joined text:', joinedText);
      
      const trimmedText = joinedText.trim();
      console.log('Trimmed text:', trimmedText);
    }
    
    // Clean up
    await result.client.session.delete({ path: { id: session.data.id } });
    
    return true;
  } catch (error) {
    console.error('Debug test failed:', error);
    console.error('Error stack:', error.stack);
    return false;
  }
}

debugPromptResult().then(success => {
  process.exit(success ? 0 : 1);
});