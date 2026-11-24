import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";

const seedPattern = /(<script id="seed" type="application\/json">)([\s\S]*?)(<\/script>)/;
const template = await readFile("public-template/index.html", "utf8");
const response = await fetch("https://lili-songbook.easyarena3.chatgpt.site/api/songs", {
  signal: AbortSignal.timeout(20000),
});
if (!response.ok) throw new Error(`Playlist request failed: ${response.status}`);
const { songs, revision } = await response.json();
if (!Number.isSafeInteger(revision) || revision < 0 || !Array.isArray(songs) ||
  songs.length > 2000 || !songs.every((song) => song &&
    Number.isSafeInteger(song.id) && song.id > 0 &&
    typeof song.title === "string" && typeof song.artist === "string") ||
  new Set(songs.map((song) => song.id)).size !== songs.length) {
  throw new Error("The published playlist endpoint returned unexpected data");
}
if (!seedPattern.test(template)) throw new Error("The page template is missing its embedded playlist");
const seed = JSON.stringify(songs.map(({ id, title, artist }) => ({ id, title, artist }))).replaceAll("<", "\\u003c");
const page = template.replace(seedPattern, (_, start, __, end) => start + seed + end);

let unchanged = false;
if (process.env.GITHUB_EVENT_NAME === "schedule") {
  try {
    const publicPage = await fetch("https://amy104009-star.github.io/song/", {
      signal: AbortSignal.timeout(10000),
    });
    unchanged = publicPage.ok && (await publicPage.text()).trim() === page.trim();
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
}
console.log(`${songs.length} songs from revision ${revision}${unchanged ? " (unchanged)" : ""}`);
