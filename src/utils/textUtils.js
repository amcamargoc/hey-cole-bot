/**
 * Split long messages into chunks safely (respecting code blocks)
 * @param {string} text 
 * @param {number} maxLength 
 * @returns {string[]}
 */
export function splitMessage(text, maxLength = 4000) {
  if (!text || text.length <= maxLength) return [text || ''];
  
  const chunks = [];
  let currentChunk = '';
  let inCodeBlock = false;
  let codeBlockLanguage = '';

  const lines = text.split('\n');
  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        inCodeBlock = false;
        codeBlockLanguage = '';
      } else {
        inCodeBlock = true;
        codeBlockLanguage = line.trim().slice(3);
      }
    }

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
      
      if (line.length > (maxLength - 10)) {
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
    if (inCodeBlock && !finalChunk.endsWith('```')) {
      finalChunk += '\n```';
    }
    chunks.push(finalChunk);
  }
  
  return chunks.length === 0 ? [''] : chunks;
}

/**
 * Validates message content
 * @param {string} text 
 * @returns {boolean}
 */
export function isValidMessage(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim();
  return trimmed.length > 0;
}
