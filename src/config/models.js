/**
 * Global Model Configuration for El Coleto
 * Scalable structure for easy model updates
 * 
 * To change models:
 * 1. Update MODELS with new model IDs
 * 2. TIER_ORDER defines the selection order in /models command
 */

export const MODELS = {
  FAST: {
    id: 'fast',
    name: '⚡ Fast',
    modelID: 'big-pickle',
    description: 'Balanced speed & quality (Big Pickle)'
  },
  SMART: {
    id: 'smart',
    name: '🧠 Smart',
    modelID: 'minimax-m2.5-free',
    description: 'High intelligence (MiniMax M2.5 Free)'
  },
  PRO: {
    id: 'pro',
    name: '🚀 Pro',
    modelID: 'gemini-3-flash',
    description: 'Top-tier reasoning (Gemini 3 Flash)'
  }
};

export const TIER_ORDER = ['FAST', 'SMART', 'PRO'];

export const TIERS = MODELS;

export const DEFAULT_TIER = MODELS.FAST;

export const DEFAULT_MODEL = {
  providerID: 'opencode',
  modelID: MODELS.FAST.modelID
};

export function getModel(modelId) {
  return MODELS[modelId] || MODELS.FAST;
}

export function getModelById(id) {
  return Object.values(MODELS).find(m => m.id === id) || MODELS.FAST;
}

export function getVerifierModel(currentModel) {
  if (!currentModel) return DEFAULT_MODEL;
  
  const currentId = currentModel.modelId || currentModel.id;
  
  if (currentId === 'fast') return { providerID: 'opencode', modelID: MODELS.SMART.modelID };
  if (currentId === 'smart') return { providerID: 'opencode', modelID: MODELS.PRO.modelID };
  if (currentId === 'pro') return { providerID: 'opencode', modelID: MODELS.FAST.modelID };
  
  return DEFAULT_MODEL;
}