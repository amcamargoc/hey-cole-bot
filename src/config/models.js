/**
 * Global Model Configuration for El Coleto
 * Focused on 100% Free / $0 Models via OpenCode Zen
 */

export const TIERS = {
  STANDARD: {
    id: 'standard',
    name: '🥥 Standard',
    brain: 'BRAIN_A',
    providerID: 'opencode',
    modelID: 'minimax-m2.5-free',
    description: 'Fast & free workhorse (MiniMax M2.5)'
  },
  SMART: {
    id: 'smart',
    name: '🍍 Smart',
    brain: 'BRAIN_B',
    providerID: 'opencode',
    modelID: 'gemini-3-flash',
    description: 'High intelligence & large quota (Gemini 3 Flash)'
  }
};

export const BRAINS = {
  BRAIN_A: { providerID: 'opencode', modelID: 'minimax-m2.5-free' },
  BRAIN_B: { providerID: 'opencode', modelID: 'gemini-3-flash' }
};

export const DEFAULT_TIER = TIERS.STANDARD;

/**
 * Get the verifier model based on the current model.
 * If in Standard (A), use Smart (B) to verify.
 * If in Smart (B), use Standard (A) to verify.
 */
export function getVerifierModel(currentModel) {
  // If no model set, use BRAIN_B as the elite default judge
  if (!currentModel) return BRAINS.BRAIN_B;

  const isBrainA = currentModel.modelID === BRAINS.BRAIN_A.modelID;
  return isBrainA ? BRAINS.BRAIN_B : BRAINS.BRAIN_A;
}
