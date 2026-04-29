const BOX_CHARS = {
  topLeft: '┌', topRight: '┐', topMid: '┬', topDown: '├',
  bottomLeft: '└', bottomRight: '┘', bottomMid: '┴',
  midLeft: '├', midRight: '┤', midMid: '┼',
  hLine: '─', vLine: '│', space: ' '
};

/**
 * Converts markdown tables to Unicode box-drawing format for Telegram
 * @param {string} markdown 
 * @param {number} maxWidth 
 * @returns {string}
 */
export function formatTableForTelegram(markdown, maxWidth = 40) {
  if (!markdown || typeof markdown !== 'string') return markdown;
  
  const tableRegex = /\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g;
  if (!tableRegex.test(markdown)) return markdown;
  
  tableRegex.lastIndex = 0;
  
  let result = markdown;
  let match;
  
  while ((match = tableRegex.exec(markdown)) !== null) {
    const headerMatch = match[1];
    const rowsMatch = match[2];
    
    const headers = headerMatch.split('|').map(h => h.trim()).filter(h => h);
    if (headers.length === 0) continue;
    
    const colWidths = headers.map(h => h.length);
    
    const rows = rowsMatch.trim().split('\n').map(row => 
      row.split('|').map(cell => cell.trim()).filter(c => c)
    );
    
    for (const row of rows) {
      row.forEach((cell, i) => {
        if (colWidths[i] !== undefined) {
          colWidths[i] = Math.max(colWidths[i], cell.length);
        }
      });
    }
    
    const adjustedWidths = colWidths.map(w => Math.min(w, maxWidth));
    
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
      let tableText = '\n' + buildRow(headers, chars) + '\n' + separator(chars) + '\n';
      
      for (const row of rows) {
        const truncatedRow = row.map((cell, i) => 
          cell.length > adjustedWidths[i] ? cell.substring(0, adjustedWidths[i] - 3) + '...' : cell
        );
        tableText += buildRow(truncatedRow, chars) + '\n';
      }
      
      tableText += chars.bottomLeft + adjustedWidths.map(w => 
        chars.hLine.repeat(w + 2)
      ).join(chars.bottomMid) + chars.bottomRight + '\n';
      
      result = result.replace(match[0], tableText);
    } catch (e) {
      console.warn('Table formatting failed:', e.message);
    }
  }
  
  return result;
}

/**
 * Clean markdown for Telegram (remove unsupported elements)
 * @param {string} text 
 * @returns {string}
 */
export function cleanMarkdownForTelegram(text) {
  if (!text || typeof text !== 'string') return text;
  
  let result = text;
  result = formatTableForTelegram(result);
  
  result = result.replace(/\|[-:|\s]+\|/g, match => {
    const bars = match.match(/\|/g)?.length || 0;
    return '|'.repeat(bars);
  });
  
  result = result.replace(/^:\s*-\s*.+$/gm, '');
  result = result.replace(/^[\s]*[-*]\s\[[ xX]\]\s*/gm, '');
  result = result.replace(/\^(\d+)/g, '^$1');
  result = result.replace(/~(.+?)~/g, '~$1');
  
  return result;
}
