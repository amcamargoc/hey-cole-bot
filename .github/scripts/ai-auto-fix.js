import fs from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';

const OPENCODE_API_KEY = process.env.OPENCODE_API_KEY;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const PR_NUMBER = process.env.PR_NUMBER;
const COMMENT_BODY = process.env.COMMENT_BODY || '';

if (!OPENCODE_API_KEY) {
  console.error("❌ No OPENCODE_API_KEY found. Please add it to your repository secrets.");
  process.exit(1);
}

async function main() {
  console.log(`Getting context for PR #${PR_NUMBER}...`);

  const diffCommand = `gh pr diff ${PR_NUMBER}`;
  let diff = '';
  try {
    diff = execSync(diffCommand, { encoding: 'utf-8', env: { ...process.env, GH_TOKEN: GITHUB_TOKEN } });
  } catch (e) {
    console.error("Failed to fetch PR diff.");
    process.exit(1);
  }

  const commentsCommand = `gh pr view ${PR_NUMBER} --comments --json comments -q ".comments[].body"`;
  let comments = '';
  try {
    comments = execSync(commentsCommand, { encoding: 'utf-8', env: { ...process.env, GH_TOKEN: GITHUB_TOKEN } });
  } catch (e) {
    console.log("No previous comments found.");
  }

  let orchestratorSkill = '';
  try {
    orchestratorSkill = await fs.readFile('.opencode/skills/orchestrator/SKILL.md', 'utf-8');
  } catch (e) {
    console.error("❌ Failed to read .opencode/skills/orchestrator/SKILL.md");
    process.exit(1);
  }

  console.log("Asking Orchestrator to delegate the fixing task...");
  const orchestratorResponse = await fetch('https://opencode.ai/zen/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENCODE_API_KEY}`
    },
    body: JSON.stringify({
      model: 'big-pickle',
      messages: [
        { role: 'system', content: `You are the Orchestrator.\n\n${orchestratorSkill}\n\nBased on your Task Routing table, analyze the PR issues and decide which agent should fix them. Reply ONLY with the exact name of the delegated agent (e.g., 'frontend-injector', 'api-developer', etc). Do not write any other explanation or text.` },
        { role: 'user', content: `PR Diff:\n${diff}\n\nPR Comments/Errors:\n${comments}\n\nTriggering User Request:\n${COMMENT_BODY}` }
      ]
    })
  });

  if (!orchestratorResponse.ok) {
    console.error("Orchestrator API error:", orchestratorResponse.status, await orchestratorResponse.text());
    process.exit(1);
  }

  const orchData = await orchestratorResponse.json();
  if (!orchData.choices || !orchData.choices[0]) {
    console.error("Failed to get response from Orchestrator API.", orchData);
    process.exit(1);
  }

  const delegatedAgent = orchData.choices[0].message.content.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  console.log(`Orchestrator delegated the fix to: ${delegatedAgent}`);

  let agentSkill = '';
  try {
    agentSkill = await fs.readFile(`.opencode/skills/${delegatedAgent}/SKILL.md`, 'utf-8');
  } catch (e) {
    console.error(`❌ Could not load skill for ${delegatedAgent}.`);
    process.exit(1);
  }

  console.log(`Asking ${delegatedAgent} to generate the fix...`);
  const formatInstruction = `\n\nCRITICAL FIXING FORMAT INSTRUCTION:\nYou must fix the files to resolve the PR issues. For each file you modify, you MUST output the FULL replacement file content using EXACTLY this format:\n\nFILE: path/to/file.ext\n\`\`\`[language]\n<full_content_here>\n\`\`\`\n\nFailure to use this exact syntax will result in your fix being ignored. Output the entire replacement file, NO diffs.`;

  const fixResponse = await fetch('https://opencode.ai/zen/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENCODE_API_KEY}`
    },
    body: JSON.stringify({
      model: 'big-pickle',
      messages: [
        { role: 'system', content: `You are the ${delegatedAgent}.\n\n${agentSkill}\n\nYour task is to repair a failing PR.${formatInstruction}` },
        { role: 'user', content: `Pull Request Diff:\n${diff}\n\nPR Comments (including errors):\n${comments}\n\nTriggering User Request:\n${COMMENT_BODY}\n\nPlease generate the unified file fixes.` }
      ]
    })
  });

  if (!fixResponse.ok) {
    console.error(`API error from ${delegatedAgent}:`, fixResponse.status, await fixResponse.text());
    process.exit(1);
  }

  const data = await fixResponse.json();
  if (!data.choices || !data.choices[0]) {
    console.error(`Failed to get fix from ${delegatedAgent}:`, data);
    process.exit(1);
  }

  const resultString = data.choices[0].message.content;

  const regex = /FILE:\s*([^\n]+)\n```\w*\n([\s\S]*?)```/g;
  let match;
  let filesChanged = 0;
  const filesChangedList = [];
  
  const repoRoot = path.resolve(process.cwd());

  while ((match = regex.exec(resultString)) !== null) {
      const rawFilePath = match[1].trim();
      const newContent = match[2];
      
      const resolvedPath = path.resolve(repoRoot, rawFilePath);
      
      if (!resolvedPath.startsWith(repoRoot)) {
        console.error(`❌ Security rejection: Path ${rawFilePath} attempts to escape repository root.`);
        continue;
      }
      
      const relativePath = path.relative(repoRoot, resolvedPath);
      if (relativePath.startsWith('.github') || relativePath.startsWith('.git')) {
        console.error(`❌ Security rejection: Modification to restricted directory ${rawFilePath} is not allowed.`);
        continue;
      }

      try {
          await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
          await fs.writeFile(resolvedPath, newContent, 'utf-8');
          console.log(`✅ Updated ${relativePath} via ${delegatedAgent}`);
          filesChanged++;
          filesChangedList.push(relativePath);
      } catch (err) {
          console.error(`❌ Error writing to ${relativePath}:`, err);
      }
  }

  if (filesChanged === 0) {
      console.log("No files were modified by the AI. Posting comment.");
      const noChangesMsg = `The ${delegatedAgent} couldn't determine any files to change. Please review the request manually.`;
      execSync(`gh pr comment ${PR_NUMBER} -b "${noChangesMsg}"`, { env: { ...process.env, GH_TOKEN: GITHUB_TOKEN } });
      return;
  }

  console.log("Committing and pushing changes...");
  try {
      execSync(`git config --global user.name "github-actions[bot]"`);
      execSync(`git config --global user.email "github-actions[bot]@users.noreply.github.com"`);
      execSync(`git add ${filesChangedList.join(' ')}`);
      execSync(`git commit -m "🤖 AI Auto-Fix applied by ${delegatedAgent}"`);
      execSync(`git push origin HEAD`);
      
      const successMsg = `✅ Auto-Fix delegated to **${delegatedAgent}** applied successfully. Modified ${filesChanged} file(s) and pushed to the branch!`;
      execSync(`gh pr comment ${PR_NUMBER} -b "${successMsg}"`, { env: { ...process.env, GH_TOKEN: GITHUB_TOKEN } });
  } catch (err) {
      console.error("Failed to commit and push changes:", err);
      process.exit(1);
  }
}

main();