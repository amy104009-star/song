import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";

const genres = new Set(["抒情", "輕快", "動感舞曲", "搖滾", "饒舌", "古風"]);
const languages = new Set(["中文", "台語", "粵語", "英文", "韓文", "日文", "越南文"]);
const seedPattern = /(<script id="seed" type="application\/json">)([\s\S]*?)(<\/script>)/;
const template = (await readFile("public-template/index.html", "utf8")).replaceAll("\r\n", "\n");
if (!template.includes("<title>北村歌單</title>")) {
  throw new Error("The public playlist has an unexpected title");
}
if (!template.includes('href="https://lili-songbook.easyarena3.chatgpt.site/requests"')) {
  throw new Error("The public playlist is missing the saved-request lookup link");
}
if (!template.includes('href="https://lili-songbook.easyarena3.chatgpt.site/mailbox"')) {
  throw new Error("The public playlist is missing the song mailbox link");
}
if (!template.includes('<details id="artist-directory"')) {
  throw new Error("The public playlist is missing the collapsible artist list");
}
if (!template.includes("artist-directory-groups") || !template.includes("const artistCategories") ||
  !template.includes('element("details", undefined, "artist-category")')) {
  throw new Error("The public playlist is missing the grouped artist list");
}
if (!/<select id="artist"><\/select><\/label>\s*<details id="artist-directory"/.test(template) ||
  !template.includes('"全部歌手"')) {
  throw new Error("The singer dropdown must be available above the collapsible artist list");
}
if (!template.includes('<details id="draw-history"')) {
  throw new Error("The public playlist is missing the collapsible draw history");
}
if (!template.includes('id="draw-preview"') || !template.includes("const drawDuration = 3500;")) {
  throw new Error("The public playlist is missing the draw animation");
}
if (!template.includes("clipboard.writeText(song.title)") || !template.includes("copySongTitle(result.song)")) {
  throw new Error("The public playlist is missing the song title copy button");
}
if (!template.includes('class="song-filters radio-filters"') || !template.includes('id="language-buttons"') || !template.includes(".filter-chips {\n    display: flex;\n    flex-wrap: wrap;") || !template.includes('id="library-title"')) {
  throw new Error("The public playlist is missing its header or library layout");
}
if (!template.includes('id="clear-filters"') || !template.includes('href="#library-results"')) {
  throw new Error("The public playlist is missing its search result controls");
}
if (!template.includes(".playlist-header::before,") || !template.includes("center 31% / cover") || !template.includes("align-content: space-between;")) {
  throw new Error("The public playlist is missing its header photo");
}
const background = await readFile("public-template/playlist-background.jpg");
if (!/\.photo-background \{[^}]*opacity: \.3;/.test(template)) {
  throw new Error("The page backdrop must use 30% opacity");
}
const pageBackground = await readFile("public-template/playlist-page-background.jpg");
if (!template.includes('id="announcements-title"') || !template.includes('id="new-songs"')) {
  throw new Error("The public template is missing the new songs announcement board");
}
const response = await fetch("https://lili-songbook.easyarena3.chatgpt.site/api/songs", {
  signal: AbortSignal.timeout(20000),
});
if (!response.ok) throw new Error(`Playlist request failed: ${response.status}`);
const { songs, revision, announcements, message = "", messageTwo = "",
  marqueeStyle = { height: "medium", size: "medium", font: "sans" },
  hiddenLanguages = [] } = await response.json();
if (!Number.isSafeInteger(revision) || revision < 0 || !Array.isArray(songs) ||
  songs.length > 2000 || !songs.every((song) => song &&
    Number.isSafeInteger(song.id) && song.id > 0 &&
    typeof song.title === "string" && typeof song.artist === "string" &&
    (song.language === undefined || languages.has(song.language)) &&
    (song.genre === undefined || genres.has(song.genre))) ||
  new Set(songs.map((song) => song.id)).size !== songs.length) {
  throw new Error("The published playlist endpoint returned unexpected data");
}
if (!seedPattern.test(template)) throw new Error("The page template is missing its embedded playlist");
const seed = JSON.stringify(songs.map(({ id, title, artist, language, genre }) => ({ id, title, artist, language, genre }))).replaceAll("<", "\\u003c");
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
const messagePattern = /(<script id="playlist-message-data" type="application\/json">)[\s\S]*?(<\/script>)/;
const messageTwoPattern = /(<script id="playlist-message-two-data" type="application\/json">)[\s\S]*?(<\/script>)/;
const stylePattern = /(<script id="marquee-style-data" type="application\/json">)[\s\S]*?(<\/script>)/;
if (template.includes('id="marquee-pause"') || !messagePattern.test(template) || !messageTwoPattern.test(template) ||
  [message, messageTwo].some((value) => typeof value !== "string" || value.length > 300)) {
  throw new Error("Playlist message is missing or invalid");
}
const visibilityPattern = /(<script id="language-visibility-data" type="application\/json">)[\s\S]*?(<\/script>)/;
if (!visibilityPattern.test(template) || !Array.isArray(hiddenLanguages) ||
  !hiddenLanguages.every((language) => languages.has(language))) {
  throw new Error("Playlist language visibility is invalid");
}
const marqueeData = [
  [messagePattern, message],
  [messageTwoPattern, messageTwo],
  [stylePattern, marqueeStyle],
];
const templateWithMarquees = marqueeData.reduce((html, [pattern, value]) =>
  html.replace(pattern, (_, start, end) => start + JSON.stringify(value).replaceAll("<", "\\u003c") + end), template);
const page = templateWithMarquees
  .replace(visibilityPattern, (_, start, end) => start + JSON.stringify(hiddenLanguages) + end)
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
      const publicPageBackground = await fetch("https://amy104009-star.github.io/song/playlist-page-background.jpg", {
        signal: AbortSignal.timeout(10000),
      });
      unchanged = publicBackground.ok && publicPageBackground.ok &&
        Buffer.from(await publicBackground.arrayBuffer()).equals(background) &&
        Buffer.from(await publicPageBackground.arrayBuffer()).equals(pageBackground);
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
  await writeFile("site-dist/playlist-page-background.jpg", pageBackground);
}
console.log(`${songs.length} songs from revision ${revision}${unchanged ? " (unchanged)" : ""}`);
