import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";

const languages = new Set(["中文", "台語", "粵語", "英文", "韓文", "日文", "越南文"]);
const seedPattern = /(<script id="seed" type="application\/json">)([\s\S]*?)(<\/script>)/;
const template = await readFile("public-template/index.html", "utf8");
if (!template.includes("<title>北村歌單</title>")) {
  throw new Error("The public playlist has an unexpected title");
}
if (!template.includes('<details id="artist-directory"')) {
  throw new Error("The public playlist is missing the collapsible artist list");
}
if (!template.includes('<details id="draw-history"')) {
  throw new Error("The public playlist is missing the collapsible draw history");
}
if (!template.includes('id="draw-preview"') || !template.includes("const drawDuration = 3500;")) {
  throw new Error("The public playlist is missing the draw animation");
}
if (!template.includes("clipboard.writeText(song.title)")) {
  throw new Error("The public playlist is missing the song title copy button");
}
const background = await readFile("public-template/playlist-background.jpg");
if (!template.includes('id="announcements-title"') || !template.includes('id="new-songs"')) {
  throw new Error("The public template is missing the new songs announcement board");
}
const response = await fetch("https://lili-songbook.easyarena3.chatgpt.site/api/songs", {
  signal: AbortSignal.timeout(20000),
});
if (!response.ok) throw new Error(`Playlist request failed: ${response.status}`);
const { songs, revision, announcements } = await response.json();
if (!Number.isSafeInteger(revision) || revision < 0 || !Array.isArray(songs) ||
  songs.length > 2000 || !songs.every((song) => song &&
    Number.isSafeInteger(song.id) && song.id > 0 &&
    typeof song.title === "string" && typeof song.artist === "string" &&
    (song.language === undefined || languages.has(song.language))) ||
  new Set(songs.map((song) => song.id)).size !== songs.length) {
  throw new Error("The published playlist endpoint returned unexpected data");
}
if (!seedPattern.test(template)) throw new Error("The page template is missing its embedded playlist");
const seed = JSON.stringify(songs.map(({ id, title, artist, language }) => ({ id, title, artist, language }))).replaceAll("<", "\\u003c");
const announcementPattern = /(<script id="announcement-data" type="application\/json">)[\s\S]*?(<\/script>)/;
if (!announcementPattern.test(template) || !announcements ||
  !Number.isSafeInteger(announcements.lastAddedAt) || !Array.isArray(announcements.ids) ||
  !announcements.ids.every(Number.isSafeInteger)) {
  throw new Error("Announcement metadata is missing or invalid");
}
const notice = JSON.stringify({ lastAddedAt: announcements.lastAddedAt, ids: announcements.ids });
if (!template.includes("function titleLength(title)") || !template.includes("function isEnglishTitle(title)")) {
  throw new Error("The public playlist is missing the title length and English song grouping");
}
const page = template
  .replace(seedPattern, (_, start, __, end) => start + seed + end)
  .replace(announcementPattern, (_, start, end) => start + notice + end);

let unchanged = false;
if (process.env.GITHUB_EVENT_NAME === "schedule") {
  try {
    const publicPage = await fetch("https://amy104009-star.github.io/song/", {
      signal: AbortSignal.timeout(10000),
    });
    if (publicPage.ok && (await publicPage.text()).trim() === page.trim()) {
      const publicBackground = await fetch("https://amy104009-star.github.io/song/playlist-background.jpg", {
        signal: AbortSignal.timeout(10000),
      });
      unchanged = publicBackground.ok && Buffer.from(await publicBackground.arrayBuffer()).equals(background);
    }
  } catch {
    // If the comparison is unavailable, publish the validated snapshot.
  }
}
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `publish=${!unchanged}\n`);
}
if (!unchanged) {
  await mkdir("site-dist", { recursive: true });
  await writeFile("site-dist/index.html", page);
  await writeFile("site-dist/playlist-background.jpg", background);
}
console.log(`${songs.length} songs from revision ${revision}${unchanged ? " (unchanged)" : ""}`);
