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

// Telegram-friendly table formatting
// Converts markdown tables to Unicode box-drawing format
const BOX_CHARS = {
  topLeft: '┌', topRight: '┐', topMid: '┬', topDown: '├',
  bottomLeft: '└', bottomRight: '┘', bottomMid: '┴',
  midLeft: '├', midRight: '┤', midMid: '┼',
  hLine: '─', vLine: '│', space: ' '
};

export function formatTableForTelegram(markdown, maxWidth = 40) {
  if (!markdown || typeof markdown !== 'string') return markdown;
  
  // Check if there's a markdown table in the text
  const tableRegex = /\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g;
  if (!tableRegex.test(markdown)) return markdown;
  
  // Reset regex lastIndex
  tableRegex.lastIndex = 0;
  
  let result = markdown;
  let match;
  
  while ((match = tableRegex.exec(markdown)) !== null) {
    const headerMatch = match[1];
    const rowsMatch = match[2];
    
    // Parse header row
    const headers = headerMatch.split('|').map(h => h.trim()).filter(h => h);
    if (headers.length === 0) continue;
    
    // Calculate column widths
    const colWidths = headers.map(h => h.length);
    
    // Parse data rows
    const rows = rowsMatch.trim().split('\n').map(row => 
      row.split('|').map(cell => cell.trim()).filter(c => c)
    );
    
    // Update column widths from data
    for (const row of rows) {
      row.forEach((cell, i) => {
        if (colWidths[i] !== undefined) {
          colWidths[i] = Math.max(colWidths[i], cell.length);
        }
      });
    }
    
    // Truncate columns if too wide
    const adjustedWidths = colWidths.map(w => Math.min(w, maxWidth));
    
    // Build table
    const buildRow = (cells, chars) => {
      return chars.vLine + cells.map((cell, i) => {
        const padded = cell.padEnd(adjustedWidths[i], ' ');
        return ' ' + padded + ' ' + chars.vLine;
      }).join('');
    };
    
    const separator = chars => {
      return chars.topLeft + adjustedWidths.map(w => 
        chars.hLine.repeat(w + 2)
      ).join(chars.topMid) + chars.topRight;
    };
    
    const chars = BOX_CHARS;
    
    try {
      // Build the table
      let tableText = '\n' + buildRow(headers, chars) + '\n' + separator(chars) + '\n';
      
      for (const row of rows) {
        // Truncate cells if needed
        const truncatedRow = row.map((cell, i) => 
          cell.length > adjustedWidths[i] ? cell.substring(0, adjustedWidths[i] - 3) + '...' : cell
        );
        tableText += buildRow(truncatedRow, chars) + '\n';
      }
      
      // Bottom border
      tableText += chars.bottomLeft + adjustedWidths.map(w => 
        chars.hLine.repeat(w + 2)
      ).join(chars.bottomMid) + chars.bottomRight + '\n';
      
      // Replace markdown table with formatted table
      result = result.replace(match[0], tableText);
    } catch (e) {
      // If formatting fails, keep original
      console.warn('Table formatting failed:', e.message);
    }
  }
  
  return result;
}

// Clean markdown for Telegram (remove unsupported elements)
export function cleanMarkdownForTelegram(text) {
  if (!text || typeof text !== 'string') return text;
  
  let result = text;
  
  // Convert markdown tables to Telegram format
  result = formatTableForTelegram(result);
  
  // Remove table row separators (|---|) that Telegram can't render
  result = result.replace(/\|[-:|\s]+\|/g, match => {
    // Keep just vertical bars for simple tables
    const bars = match.match(/\|/g)?.length || 0;
    return '|'.repeat(bars);
  });
  
  // Remove definition lists (: -) which aren't supported
  result = result.replace(/^:\s*-\s*.+$/gm, '');
  
  // Remove task list checkboxes
  result = result.replace(/^[\s]*[-*]\s\[[ xX]\]\s*/gm, '');
  
  // Convert superscript/subscript (some not supported)
  result = result.replace(/\^(\d+)/g, '^$1');
  result = result.replace(/~(.+?)~/g, '~$1');
  
  return result;
}
