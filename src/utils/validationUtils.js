/**
 * Password strength validation
 * @param {string} password 
 * @returns {boolean} True if password meets all requirements
 */
export function isStrongPassword(password) {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 12) return false;
  
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  return hasUpper && hasLower && hasNumber && hasSpecial;
}

/**
 * Validates password and returns array of error messages
 * @param {string} password 
 * @returns {string[]} Array of missing requirements
 */
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
