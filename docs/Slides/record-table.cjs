// Records the live round table (topic -> seat agents -> talk -> output) as webm.
// usage: node record-table.cjs <topicIndex 0-4> <outDir>
const { chromium } = require("../presentation/node_modules/playwright-core");
const fs = require("fs");
const topicIdx = +(process.argv[2] ?? 2);
const out = process.argv[3] ?? "shots/raw";
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 }, colorScheme: "light",
  });
  const page = await ctx.newPage();
  // CDP screencast -> numbered jpgs + timing list (playwright's own recorder needs a ffmpeg download)
  const cdp = await ctx.newCDPSession(page); const frames = [];
  cdp.on("Page.screencastFrame", (f) => { frames.push({ t: f.metadata.timestamp, d: f.data }); cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {}); });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, everyNthFrame: 1 });
  await page.goto("https://agentsdiscusstors.vercel.app/", { waitUntil: "networkidle" });
  if (await page.getByRole("button", { name: "Switch to light theme" }).count()) await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Round table", exact: true }).click();
  await page.waitForTimeout(1200);
  const topics = page.locator(".bank button");
  await topics.nth(topicIdx).click();
  await page.waitForTimeout(900);
  for (const n of ["Manager", "Marketing lead", "Finance and Ops lead", "Legal Team lead", "Personal Assist."]) {
    await page.locator(`button.member[title="${n}"]`).evaluate((e) => e.click());
    await page.waitForTimeout(450);
  }
  await page.mouse.move(640, 420); // close the hover-open character panel
  await page.waitForTimeout(2800); // let them walk in and sit
  await page.getByRole("button", { name: "Start talking" }).click();
  // wait for a full run: button goes thinking -> Stop talking -> Start talking
  await page.getByRole("button", { name: "Stop talking" }).waitFor({ timeout: 120000 });
  await page.getByRole("button", { name: "Start talking" }).waitFor({ timeout: 240000 });
  await page.waitForTimeout(3500);
  console.log((await page.locator(".transcript").innerText()).slice(0, 2500));
  await cdp.send("Page.stopScreencast");
  let list = "";
  frames.forEach((f, i) => {
    const name = `f${String(i).padStart(5, "0")}.jpg`;
    fs.writeFileSync(`${out}/${name}`, Buffer.from(f.d, "base64"));
    const dur = i < frames.length - 1 ? frames[i + 1].t - f.t : 0.1;
    list += `file '${name}'
duration ${dur.toFixed(4)}
`;
  });
  list += `file 'f${String(frames.length - 1).padStart(5, "0")}.jpg'
`;
  fs.writeFileSync(`${out}/list.txt`, list);
  console.log("frames", frames.length, "seconds", (frames.at(-1).t - frames[0].t).toFixed(1));
  await ctx.close(); await browser.close();
})().catch((e) => { console.error("FAIL", e.message); process.exit(1); });
