import test from 'node:test';
import assert from 'node:assert/strict';

// Test helper: parseTime from commands.js
function parseTime(timeStr) {
  const now = new Date();
  const lower = timeStr.toLowerCase();
  
  // Handle 24-hour format: "19:00", "7:00", "19", "07"
  const time24Match = lower.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (time24Match) {
    let hours = parseInt(time24Match[1], 10);
    const minutes = time24Match[2] ? parseInt(time24Match[2], 10) : 0;
    
    // Validate 24-hour range (0-23)
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      const result = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
      if (result.getTime() <= Date.now()) {
        result.setDate(result.getDate() + 1);
      }
      return Math.floor(result.getTime() / 1000);
    }
    return null;
  }
  
  // Handle 12-hour format with am/pm: "7am", "7:00am", "7pm", "7:30pm"
  const timeMatch = lower.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const period = timeMatch[3];
    
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    
    // Require am/pm for 12-hour format to avoid ambiguity
    if (!period && hours < 12) return null;
    
    const result = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
    if (result.getTime() <= Date.now()) {
      result.setDate(result.getDate() + 1);
    }
    return Math.floor(result.getTime() / 1000);
  }
  
  // Handle "tomorrow 19:00" (24-hour)
  if (lower.startsWith('tomorrow ')) {
    const rest = lower.replace('tomorrow ', '');
    const match24 = rest.match(/^(\d{1,2})(?::(\d{2}))?$/);
    if (match24) {
      let hours = parseInt(match24[1], 10);
      const minutes = match24[2] ? parseInt(match24[2], 10) : 0;
      if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
        const result = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hours, minutes, 0);
        return Math.floor(result.getTime() / 1000);
      }
    }
    // Handle "tomorrow 7am"
    const match = rest.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      const period = match[3];
      
      if (period === 'pm' && hours < 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;
      
      const result = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hours, minutes, 0);
      return Math.floor(result.getTime() / 1000);
    }
  }
  
  // Handle day names with 24-hour: "monday 19:00", "tuesday 9:00"
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < days.length; i++) {
    if (lower.startsWith(days[i])) {
      const rest = lower.replace(days[i] + ' ', '');
      
      // Try 24-hour first
      const match24 = rest.match(/^(\d{1,2})(?::(\d{2}))?$/);
      if (match24) {
        let hours = parseInt(match24[1], 10);
        const minutes = match24[2] ? parseInt(match24[2], 10) : 0;
        if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
          let targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
          let daysUntil = i - now.getDay();
          if (daysUntil <= 0) daysUntil += 7;
          targetDate.setDate(targetDate.getDate() + daysUntil);
          return Math.floor(targetDate.getTime() / 1000);
        }
      }
      
      // Try 12-hour with am/pm
      const match = rest.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = match[2] ? parseInt(match[2], 10) : 0;
        const period = match[3];
        
        if (period === 'pm' && hours < 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;
        
        let targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0);
        let daysUntil = i - now.getDay();
        if (daysUntil <= 0) daysUntil += 7;
        targetDate.setDate(targetDate.getDate() + daysUntil);
        
        return Math.floor(targetDate.getTime() / 1000);
      }
    }
  }
  
  return null;
}

// 24-hour format tests
test('parseTime handles 24-hour "19:00"', (t) => {
  const result = parseTime('19:00');
  
  assert.ok(result !== null);
  const date = new Date(result * 1000);
  assert.strictEqual(date.getHours(), 19);
  assert.strictEqual(date.getMinutes(), 0);
});

test('parseTime handles 24-hour "7:00"', (t) => {
  const result = parseTime('7:00');
  
  assert.ok(result !== null);
  const date = new Date(result * 1000);
  assert.strictEqual(date.getHours(), 7);
  assert.strictEqual(date.getMinutes(), 0);
});

test('parseTime handles 24-hour "0" (midnight)', (t) => {
  const result = parseTime('0');
  
  assert.ok(result !== null);
  const date = new Date(result * 1000);
  assert.strictEqual(date.getHours(), 0);
});

test('parseTime handles 24-hour "23:59"', (t) => {
  const result = parseTime('23:59');
  
  assert.ok(result !== null);
  const date = new Date(result * 1000);
  assert.strictEqual(date.getHours(), 23);
  assert.strictEqual(date.getMinutes(), 59);
});

test('parseTime handles 24-hour "tomorrow 19:00"', (t) => {
  const result = parseTime('tomorrow 19:00');
  
  assert.ok(result !== null);
  const date = new Date(result * 1000);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  assert.strictEqual(date.getDate(), tomorrow.getDate());
  assert.strictEqual(date.getHours(), 19);
});

test('parseTime handles 24-hour "monday 19:00"', (t) => {
  const result = parseTime('monday 19:00');
  
  assert.ok(result !== null);
  const date = new Date(result * 1000);
  assert.strictEqual(date.getDay(), 1);
  assert.strictEqual(date.getHours(), 19);
});

// 12-hour format tests (still work with am/pm)
test('parseTime handles "7am"', (t) => {
  const result = parseTime('7am');
  
  assert.ok(result !== null);
  const date = new Date(result * 1000);
  assert.strictEqual(date.getHours(), 7);
  assert.strictEqual(date.getMinutes(), 0);
});

test('parseTime handles "7pm"', (t) => {
  const result = parseTime('7pm');
  
  assert.ok(result !== null);
  const date = new Date(result * 1000);
  assert.strictEqual(date.getHours(), 19);
});

test('parseTime handles "7:30am"', (t) => {
  const result = parseTime('7:30am');
  
  assert.ok(result !== null);
  const date = new Date(result * 1000);
  assert.strictEqual(date.getHours(), 7);
  assert.strictEqual(date.getMinutes(), 30);
});

test('parseTime handles "7:30pm"', (t) => {
  const result = parseTime('7:30pm');
  
  assert.ok(result !== null);
  const date = new Date(result * 1000);
  assert.strictEqual(date.getHours(), 19);
  assert.strictEqual(date.getMinutes(), 30);
});

test('parseTime handles "12pm" (noon)', (t) => {
  const result = parseTime('12pm');
  
  assert.ok(result !== null);
  const date = new Date(result * 1000);
  assert.strictEqual(date.getHours(), 12);
});

test('parseTime handles "12am" (midnight)', (t) => {
  const result = parseTime('12am');
  
  assert.ok(result !== null);
  const date = new Date(result * 1000);
  assert.strictEqual(date.getHours(), 0);
});

test('parseTime handles "tomorrow 7am"', (t) => {
  const result = parseTime('tomorrow 7am');
  
  assert.ok(result !== null);
  const date = new Date(result * 1000);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  assert.strictEqual(date.getDate(), tomorrow.getDate());
  assert.strictEqual(date.getHours(), 7);
});

test('parseTime handles "monday 9am"', (t) => {
  const result = parseTime('monday 9am');
  
  assert.ok(result !== null);
  const date = new Date(result * 1000);
  // Monday is day 1
  assert.strictEqual(date.getDay(), 1);
  assert.strictEqual(date.getHours(), 9);
});

test('parseTime handles "friday 5pm"', (t) => {
  const result = parseTime('friday 5pm');
  
  assert.ok(result !== null);
  const date = new Date(result * 1000);
  // Friday is day 5
  assert.strictEqual(date.getDay(), 5);
  assert.strictEqual(date.getHours(), 17);
});

test('parseTime treats single digit "7" as 24-hour format', (t) => {
  // Single digits (0-23) are interpreted as 24-hour format, which is what user likely wants
  const result = parseTime('7');
  
  assert.ok(result !== null);
  const date = new Date(result * 1000);
  assert.strictEqual(date.getHours(), 7);
});

test('parseTime returns null for invalid input', (t) => {
  assert.strictEqual(parseTime('invalid'), null);
  assert.strictEqual(parseTime('notatime'), null);
  assert.strictEqual(parseTime(''), null);
  assert.strictEqual(parseTime('at noon'), null);
  // Invalid 24-hour
  assert.strictEqual(parseTime('25:00'), null);
  assert.strictEqual(parseTime('12:60'), null);
});

test('parseTime schedules for future when time has passed today', (t) => {
  const now = new Date();
  const currentHour = now.getHours();
  
  // If it's past 7am, scheduling 7am should give tomorrow
  const result = parseTime('7am');
  const date = new Date(result * 1000);
  
  if (currentHour >= 7) {
    assert.strictEqual(date.getDate(), now.getDate() + 1);
  } else {
    assert.strictEqual(date.getDate(), now.getDate());
  }
});