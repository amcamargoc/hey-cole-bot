// Password strength validation
export function isStrongPassword(password) {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 12) return false;
  
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  return hasUpper && hasLower && hasNumber && hasSpecial;
}

export function validatePasswordRequirements(password) {
  const errors = [];
  if (!password) return ['Password is required'];
  if (password.length < 12) errors.push('Must be at least 12 characters');
  if (!/[A-Z]/.test(password)) errors.push('Add an uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Add a lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Add a number');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push('Add a special symbol (!@#$%)');
  return errors;
}

// Utility: Split long messages into chunks
export function splitMessage(text, maxLength = 4000) {
  if (!text || text.length <= maxLength) return [text || ''];
  
  const chunks = [];
  let currentChunk = '';
  let inCodeBlock = false;
  let codeBlockLanguage = '';

  const lines = text.split('\n');
  for (const line of lines) {
    // Check for code block start/end
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        inCodeBlock = false;
        codeBlockLanguage = '';
      } else {
        inCodeBlock = true;
        codeBlockLanguage = line.trim().slice(3);
      }
    }

    // Check if adding this line (plus newline and potential closing/opening code blocks) exceeds the limit
    const potentialNext = currentChunk + line + '\n' + (inCodeBlock ? '```' : '');
    
    if (potentialNext.length > maxLength) {
      if (currentChunk) {
        let chunkToPush = currentChunk.trimEnd();
        if (inCodeBlock) {
          chunkToPush += '\n```';
        }
        chunks.push(chunkToPush);
        
        currentChunk = inCodeBlock ? `\`\`\`${codeBlockLanguage}\n` : '';
      }
      
      // Handle the case where a single line is wider than the allowed limit
      if (line.length > (maxLength - 10)) { // Small buffer
        let remaining = line;
        while (remaining.length > (maxLength - 10)) {
          let part = remaining.slice(0, maxLength - 10);
          if (inCodeBlock) part += '\n```';
          chunks.push(part);
          remaining = (inCodeBlock ? `\`\`\`${codeBlockLanguage}\n` : '') + remaining.slice(maxLength - 10);
        }
        currentChunk = remaining + '\n';
      } else {
        currentChunk += line + '\n';
      }
    } else {
      currentChunk += line + '\n';
    }
  }
  
  if (currentChunk.trim().length > 0) {
    let finalChunk = currentChunk.trimEnd();
    // If we're still in a code block at the end, close it (though logically we shouldn't be if the input is valid)
    if (inCodeBlock && !finalChunk.endsWith('```')) {
      finalChunk += '\n```';
    }
    chunks.push(finalChunk);
  }
  
  return chunks.length === 0 ? [''] : chunks;
}

// Utility: Validate message
export function isValidMessage(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  return trimmed.length > 0;
}
