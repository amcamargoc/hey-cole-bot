import { opencodeClient } from './opencode.js';
import { logger } from './logger.js';
import { getVerifierModel } from '../config/models.js';

/**
 * Handles communication with OpenCode API, including Precision Mode logic
 */
export async function promptLLM(sessionId, promptBody, precisionMode = false, primaryModel = null) {
  const startTime = Date.now();
  
  // 1. Primary Prompt
  const result = await opencodeClient.session.prompt({
    path: { id: sessionId },
    body: promptBody,
  });

  if (result?.error) {
    throw new Error(result.error.message);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  logger.info('PROMPT', `Primary prompt completed in ${duration}s`);

  let responseText = result.data?.parts?.filter(part => part.type === 'text')?.map(part => part.text)?.join('')?.trim() || '';
  const messageId = result.data?.info?.id;

  // 2. Precision Mode Verification
  if (precisionMode && responseText && responseText !== 'Processing...') {
    try {
      const verifier = getVerifierModel(primaryModel);
      logger.verify(verifier.modelID, `Starting cross-check`);

      const verifierPrompt = `Review and correct the following response for accuracy, safety, and logic. Output ONLY the final best version without any meta-commentary:\n\n${responseText}`;
      const verifierSession = await opencodeClient.session.create({ body: { title: `Verifier ${sessionId}` } });

      const vStartTime = Date.now();
      const verifyResult = await opencodeClient.session.prompt({
        path: { id: verifierSession.data.id },
        body: {
          parts: [{ type: 'text', text: verifierPrompt }],
          system: "You are a professional verifier assistant. Cross-check the response from another model and ensure it is perfect.",
          model: verifier
        }
      });

      const vDuration = ((Date.now() - vStartTime) / 1000).toFixed(1);
      logger.info('VERIFY', `Verification completed in ${vDuration}s`);

      const verifiedText = verifyResult?.data?.parts?.filter(part => part.type === 'text')?.map(part => part.text)?.join('')?.trim();
      
      if (verifiedText) {
        responseText = verifiedText;
      }
      
      await opencodeClient.session.delete({ path: { id: verifierSession.data.id } }).catch(() => { });
    } catch (err) {
      logger.error('VERIFY', 'Precision mode failed, falling back to original response', err);
    }
  }

  return { text: responseText, messageId };
}

/**
 * Aborts an ongoing generation
 */
export async function abortGeneration(sessionId) {
  return await opencodeClient.session.abort({ path: { id: sessionId } });
}

/**
 * Reverts the last message in a session
 */
export async function undoLastMessage(sessionId) {
  return await opencodeClient.session.revert({ path: { id: sessionId } });
}

/**
 * Summarizes the session
 */
export async function summarizeSession(sessionId, model = null) {
  return await opencodeClient.session.summarize({ 
    path: { id: sessionId },
    body: { 
      providerID: model?.providerID || 'default', 
      modelID: model?.modelID || 'default' 
    }
  });
}
