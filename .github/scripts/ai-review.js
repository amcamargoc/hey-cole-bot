import fs from 'fs/promises';
import { execSync } from 'child_process';

const OPENCODE_API_KEY = process.env.OPENCODE_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const PR_NUMBER = process.env.PR_NUMBER;

if (!OPENCODE_API_KEY) {
  console.error("❌ No OPENCODE_API_KEY found. Please add it to your repository secrets.");
  process.exit(1);
}

async function runSkill(skillPath, diff, roleName) {
  try {
    const skillInstructions = await fs.readFile(skillPath, 'utf-8');
    
    console.log(`Analyzing with ${roleName}...`);
    
    const response = await fetch('https://opencode.ai/zen/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENCODE_API_KEY}`
      },
      body: JSON.stringify({
        model: 'big-pickle',
        messages: [
          { role: 'system', content: `Please execute the following role based on these instructions:\n\n${skillInstructions}` },
          { role: 'user', content: `Please review the following PR diff and return your markdown review:\n\n${diff}` }
        ]
      })
    });

    const data = await response.json();
    if (!data.choices || !data.choices[0]) {
      console.error(`Received unexpected API response for ${roleName}:`, {
        error: data.error,
        type: data.type
      });
      return `Failed to run ${roleName} review: Unexpected API response.`;
    }
    return data.choices[0].message.content;
  } catch (error) {
    console.error(`Error running skill ${roleName}:`, error);
    return `Failed to run ${roleName} review.`;
  }
}

async function main() {
  const diffCommand = 'git diff origin/main...HEAD';
  let diff = '';
  try {
     diff = execSync(diffCommand, { encoding: 'utf-8' });
  } catch (e) {
     console.error("Error executing git diff. Make sure you fetch base branch correctly.");
     process.exit(1);
  }
  
  if (!diff.trim()) {
    console.log("No changes in this diff. Exiting.");
    process.exit(0);
  }

  console.log("Running Code Reviewer... ");
  const codeReviewResult = await runSkill('.opencode/skills/review/SKILL.md', diff, 'Code-Reviewer');
  
  console.log("Running Security Auditor... ");
  const securityReviewResult = await runSkill('.opencode/skills/audit/SKILL.md', diff, 'Security-Auditor');

  const commentBody = `
## 🤖 AI Code Review (Agent)
${codeReviewResult}

---

## 🔒 Security Audit (Agent)
${securityReviewResult}
`;

  console.log("Posting results to GitHub PR...");
  
  const postCommentCommand = `gh pr comment ${PR_NUMBER} -F -`;
  
  execSync(postCommentCommand, {
    input: commentBody,
    env: { ...process.env, GH_TOKEN: GITHUB_TOKEN }
  });

  const blockRegex = /^(\*\*?)?Status:(\*\*?)?\s*(🔴|❌)\s*Block/mi;
  const hasCodeErrors = blockRegex.test(codeReviewResult);
  const hasSecurityErrors = blockRegex.test(securityReviewResult);

  if (hasCodeErrors || hasSecurityErrors) {
    console.error("❌ AI Review final status was set to Block. Failing the workflow.");
    process.exit(1);
  }
}

main();