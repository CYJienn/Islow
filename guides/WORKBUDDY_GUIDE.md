# WorkBuddy Guide: What It Does and Why It Helps

Compiled 2026-10-09. Items are tagged **[official]** (workbuddy.ai or Tencent docs) or **[third-party]**. Nothing here has been tested on a live install, so run the checklist at the bottom before relying on it.

## 1. What it is

WorkBuddy is a desktop AI agent from Tencent, built by the CodeBuddy team. You describe a goal, it plans the steps, works on files in folders you authorize, and returns **finished files** instead of chat answers. It launched in China in March 2026 and went global later. It is OpenClaw-compatible.

## 2. Benefits

| Benefit | Why it matters |
|---|---|
| Deliverables, not answers | You get a .docx, .xlsx or .pptx you can open and edit, not text to copy and paste |
| You control the risk | Ask, Plan and Craft modes plus a sandbox. Plan shows its steps before anything runs |
| Local files stay local | It only touches folders you authorize. Read the privacy policy: data may be processed outside your country |
| Reuse beats re-prompting | Skills, Experts and Memory carry your standards across tasks, which also saves tokens |
| Switch models per task | Cheap model for bulk work, stronger for hard cases, or your own endpoint |
| Runs without you (partly) | Scheduled tasks and phone triggers, if the computer is on |
| Safety nets | Safe delete or recycle bin; on Windows a backup copy before it modifies a file |

## 3. Capabilities

### 3.1 Documents and data [official]
- Create, edit, merge, convert and analyze Word, Excel, PowerPoint, PDF and image files via the **Office Document Suite** skill (install it from the Marketplace).
- Batch jobs: rename, organize and convert groups of files.
- Results panel with four views: Artifacts, All Files, Changes, Preview.

### 3.2 Research and browsing [official]
- Web Search, Google Search and **Agent Browser** skills (describe the goal, not selectors).
- Local Whisper (speech-to-text), yt-dlp downloader, Obsidian integration.

### 3.3 Connected apps [official]
- Connectors: GitHub, GitLab, Jira, Confluence, Google Drive, Gmail, Notion, Slack. Authorize with OAuth or API credentials, then confirm the status shows "Connected".
- Custom **MCP servers** via Settings > MCP (OAuth servers refresh tokens automatically). Some sources instead describe editing `~/.workbuddy/mcp.json`; trust what your screen shows.

### 3.4 Extending it [official]
- **Skills:** a folder containing `SKILL.md` (name, description, inputs, steps, output format). Many are pure text. Each skill is security-scanned before install. Keep the description specific so it triggers at the right time.
- **Experts and Expert Groups:** domain personas in Writing, Data, Development, Design and Business; groups combine several experts in a workflow. A popularity leaderboard exists.
- **Explore:** a gallery of finished community works. "Make My Version" pre-fills the prompt, skills and expert.

### 3.5 Automation and remote control [official]
- **Automation:** sidebar > New Automation. Hourly (every N hours), daily, weekly or one-time, with templates. Results can be pushed to Slack, Telegram or Discord.
- **Assistant:** send tasks from your phone via Slack, Telegram, Discord, WeCom, Feishu, DingTalk, QQ, YuanbaoPai and a WeChat bot. **WhatsApp is not listed.**

### 3.6 Memory [official]
- On by default; summaries refresh nightly; entries are viewable and editable. You can tell it to remember or forget something, and import habits from another AI product.
- [third-party, unverified] Hidden files `IDENTITY.md`, `SOUL.md`, `USER.md` under `~/.workbuddy/` control behavior and can sync across devices.

### 3.7 Coding [partly official]
- The task bar has a **Work Mode / Coding Mode** switch. The docs do not say how far Coding Mode goes (running Python, servers, packages). CodeBuddy is positioned as the real coding tool.

### 3.8 Permissions and safety [official]
- **Default Permissions:** asks before sensitive paths, deleting many files, running scripts or commands, and network or high-risk actions. Commands run under sandbox constraints first.
- **Full Access:** removes the per-step prompts. Docs advise against using it with production or customer data.

### 3.9 Team and spend controls [official, Team plan]
- SSO, role-based access, per-seat credit quotas, usage dashboards, budget caps with alerts, IP allowlists, access logs.

### 3.10 Models and credits
- Switchable models: Hy3, Hy4 Preview, DeepSeek, GLM, Kimi, or a custom OpenAI-compatible endpoint (TokenHub). Per-million-token prices differ by roughly 20x between models.
- Credits are the cost unit. Your hackathon track provides dedicated credits.

## 4. Where it is weaker

- Automation and phone triggers need the computer on and WorkBuddy running.
- Permission prompts can stall an unattended run that needs to execute a script.
- Vague prompts burn credits and produce generic output.
- The docs are silent on: number of automations allowed, behavior when the machine sleeps, and how far Coding Mode goes.
- The Data page only covers shared files and archived tasks. Check the privacy policy before using real customer data.
- No independent security audit of WorkBuddy was found. Its sibling OpenClaw has known prompt-injection and misconfiguration risks.

## 5. A good first hour

1. Install it and open **Explore**. Pick a case close to your idea and press "Make My Version".
2. Install the Office Document Suite skill from the Marketplace.
3. Make a project folder with a few sample files and set it as the working folder.
4. Start in **Ask**, move to **Plan** for real work, use **Craft** only for small reversible edits.
5. Write one specific prompt: action, file, format, length, audience, one example.
6. Open the **Changes** panel and check what it did.
7. Turn the winning prompt into a `SKILL.md`.
8. Try one automation and one phone trigger.
9. Set a cheap model as the default.
10. Review Memory and delete anything you do not want carried over.

## 6. Test checklist before the event

- [ ] Create a one-hour automation on a local folder. Does it run with the lid closed or screen locked?
- [ ] Make that automation run a small script. Does it stall on a permission prompt?
- [ ] Switch to Coding Mode and run a 3-line Python script. Does it execute?
- [ ] Send a task from Telegram. Does the result come back?
- [ ] Drop a test `SKILL.md` in the skills folder, start a fresh chat, confirm it triggers.
- [ ] Check what your track credits cover (cheap model, automations).
- [ ] Review Memory for stale entries.

## 7. Best fit for a hackathon

Lean into what it does best: a folder in, a finished document out, with a visible approval step. Avoid anything that needs a hosted server or many users, since that is where an office agent is weakest.

## Sources

- [Automation Guide](https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Automation-Guide)
- [Assistant](https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Assistant)
- [Permission Modes](https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Permission-Modes)
- [Memory](https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Memory)
- [Expert Center](https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Expert-Center)
- [Task Bar](https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Task-Bar)
- [Skills Market](https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Skills-Market)
- [Connectors](https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Connector)
- [Explore](https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Explore)
- [Data](https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/Data)
- [MCP Guide](https://www.workbuddy.ai/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide)
- [Office Document Suite](https://www.tencentcloud.com/techpedia/144346?lang=en)
- [Custom skills](https://www.tencentcloud.com/techpedia/144337)
- [Agent Browser skill](https://www.tencentcloud.com/techpedia/144335)
- [What is WorkBuddy (Tencent Cloud)](https://www.tencentcloud.com/techpedia/145619?lang=en)
- [WorkBuddy product page](https://www.tencentcloud.com/act/pro/workbuddy)
- [TechNode launch coverage](https://technode.com/2026/03/09/tencent-launches-openclaw-like-workplace-ai-agent-workbuddy/)
- [Memory case study (third-party)](https://llm-agent.cc/en/blog/workbuddy-memory-sync-custom-rules-cases-en)
