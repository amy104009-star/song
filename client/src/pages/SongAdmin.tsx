import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Song } from "@/data/songs";

const repository = "amy104009-star/song";
const repoUrl = `https://api.github.com/repos/${repository}`;
const fileUrl = `${repoUrl}/contents/client/src/data/songs.json`;
const tokenSettings = "https://github.com/settings/personal-access-tokens/new";
const emptySong = { title: "", artist: "" };
const inputStyle = "h-11 border-amber-200 bg-white text-base";
const primaryStyle =
  "min-h-11 bg-yellow-300 font-bold text-amber-950 hover:bg-yellow-400";
const secondaryStyle =
  "min-h-11 border-amber-200 bg-white text-amber-950 hover:bg-yellow-100";

async function github<T>(
  url: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    if (response.status === 401)
      throw new Error("權杖無效或已到期，請換一個權杖。");
    if (response.status === 403 || response.status === 404) {
      throw new Error(
        "GitHub 拒絕存取。請確認權杖已選取 song 儲存庫，且 Contents 為 Read and write。"
      );
    }
    if (response.status === 409 || response.status === 422) {
      throw new Error(
        "GitHub 拒絕這次儲存。若歌單已被更新，請記下待修改的內容，重新連線後再編輯。"
      );
    }
    throw new Error(
      `GitHub 暫時無法完成操作（${response.status}）。請稍後再試。`
    );
  }
  return response.json() as Promise<T>;
}

function decodeSongs(content: string): Song[] {
  const bytes = Uint8Array.from(atob(content), character =>
    character.charCodeAt(0)
  );
  const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (
    !Array.isArray(data) ||
    !data.every(
      song =>
        song &&
        Number.isSafeInteger(song.id) &&
        song.id > 0 &&
        typeof song.title === "string" &&
        typeof song.artist === "string"
    ) ||
    new Set(data.map(song => song.id)).size !== data.length
  ) {
    throw new Error("GitHub 上的歌曲資料格式有誤，請先檢查 songs.json。");
  }
  return data;
}

function encodeSongs(songs: Song[]) {
  const bytes = new TextEncoder().encode(JSON.stringify(songs, null, 2) + "\n");
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(""));
}

export default function SongAdmin() {
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [sha, setSha] = useState("");
  const [list, setList] = useState<Song[]>([]);
  const [changes, setChanges] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState(emptySong);
  const [editId, setEditId] = useState<number | null>(null);
  const hasUnsaved =
    changes || Boolean(draft.title.trim() || draft.artist.trim());
  const search = query.trim().toLowerCase();
  const visibleSongs = list.filter(
    song =>
      song.title.toLowerCase().includes(search) ||
      song.artist.toLowerCase().includes(search)
  );

  useEffect(() => {
    if (!hasUnsaved) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved]);

  function clearForm() {
    setEditId(null);
    setDraft(emptySong);
  }

  async function connect(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const key = token.trim();
      if (!key.startsWith("github_pat_")) {
        throw new Error(
          "請使用 GitHub 的 Fine-grained personal access token。"
        );
      }
      const user = await github<{ login: string }>(
        "https://api.github.com/user",
        key
      );
      if (user.login.toLowerCase() !== "amy104009-star") {
        throw new Error("請使用 amy104009-star 帳號建立的權杖。");
      }
      const file = await github<{ content: string; sha: string }>(
        `${fileUrl}?ref=main`,
        key
      );
      setList(decodeSongs(file.content));
      setSha(file.sha);
      setToken(key);
      setConnected(true);
      setNotice("已連線到 GitHub。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "連線失敗，請重試。");
    } finally {
      setBusy(false);
    }
  }

  function disconnect() {
    if (
      hasUnsaved &&
      !window.confirm("離開會放棄尚未儲存的修改。確定要登出嗎？")
    )
      return;
    setConnected(false);
    setToken("");
    setSha("");
    setList([]);
    setChanges(false);
    setQuery("");
    setError("");
    setNotice("");
    clearForm();
  }

  function applySong(event: FormEvent) {
    event.preventDefault();
    const title = draft.title.trim();
    const artist = draft.artist.trim();
    if (!title || !artist) return;
    if (editId === null) {
      const id =
        list.reduce((largest, song) => Math.max(largest, song.id), 0) + 1;
      setList([...list, { id, title, artist }]);
    } else {
      setList(
        list.map(song =>
          song.id === editId ? { id: editId, title, artist } : song
        )
      );
    }
    setChanges(true);
    setError("");
    setNotice("已更新草稿。請按「儲存到 GitHub」發布變更。");
    clearForm();
  }

  function removeSong(song: Song) {
    if (!window.confirm(`要從歌單移除「${song.title}」嗎？`)) return;
    setList(list.filter(entry => entry.id !== song.id));
    if (editId === song.id) clearForm();
    setChanges(true);
    setError("");
    setNotice("已從草稿移除。請按「儲存到 GitHub」發布變更。");
  }

  async function save() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await github<{ content: { sha: string } }>(fileUrl, token, {
        method: "PUT",
        body: JSON.stringify({
          branch: "main",
          message: "更新璃璃歌單",
          sha,
          content: encodeSongs(list),
        }),
      });
      setSha(saved.content.sha);
      setChanges(false);
      setNotice("已儲存到 GitHub。部署完成後，公開歌單會自動更新。");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "儲存失敗，草稿已保留。"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#FFF8DC] via-[#FFFACD] to-[#FFE4B5] px-4 py-8 text-amber-950">
      <div className="mx-auto grid max-w-3xl gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">🌙 管理璃璃歌單</h1>
          <a
            href={import.meta.env.BASE_URL}
            className="py-2 font-medium underline underline-offset-4"
          >
            回公開歌單
          </a>
        </header>
        {!connected ? (
          <form
            onSubmit={connect}
            className="grid gap-4 rounded-2xl border border-amber-200 bg-white/85 p-5 sm:p-7"
          >
            <h2 className="text-xl font-bold">連線到 GitHub</h2>
            <p>
              用 amy104009-star 建立一個只授權 song 儲存庫的權杖，將 Contents
              設為 Read and write。
            </p>
            <a
              href={tokenSettings}
              target="_blank"
              rel="noreferrer"
              className="w-fit underline underline-offset-4"
            >
              建立 GitHub 權杖
            </a>
            <label className="grid gap-2 font-medium">
              GitHub 權杖
              <Input
                className={inputStyle}
                type="password"
                value={token}
                onChange={event => setToken(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                required
                disabled={busy}
              />
            </label>
            <Button className={primaryStyle} disabled={busy}>
              {busy ? "連線中…" : "連線"}
            </Button>
          </form>
        ) : (
          <>
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 shadow-sm">
              <span className="font-medium">
                {changes ? "有待儲存的修改" : `共 ${list.length} 首`}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button
                  className={primaryStyle}
                  onClick={save}
                  disabled={
                    busy ||
                    !changes ||
                    Boolean(draft.title.trim() || draft.artist.trim())
                  }
                >
                  {busy ? "儲存中…" : "儲存到 GitHub"}
                </Button>
                <Button
                  variant="outline"
                  className={secondaryStyle}
                  onClick={disconnect}
                  disabled={busy}
                >
                  登出
                </Button>
              </div>
            </div>
            <form
              id="song-form"
              onSubmit={applySong}
              className="grid gap-4 rounded-2xl border border-amber-200 bg-white/85 p-5"
            >
              <h2 className="text-xl font-bold">
                {editId === null ? "新增歌曲" : "編輯歌曲"}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 font-medium">
                  歌名
                  <Input
                    className={inputStyle}
                    value={draft.title}
                    onChange={event =>
                      setDraft({ ...draft, title: event.target.value })
                    }
                    maxLength={200}
                    required
                    disabled={busy}
                  />
                </label>
                <label className="grid gap-2 font-medium">
                  歌手
                  <Input
                    className={inputStyle}
                    value={draft.artist}
                    onChange={event =>
                      setDraft({ ...draft, artist: event.target.value })
                    }
                    maxLength={200}
                    required
                    disabled={busy}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  className={primaryStyle}
                  disabled={busy || !draft.title.trim() || !draft.artist.trim()}
                >
                  {editId === null ? "加入草稿" : "更新草稿"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className={secondaryStyle}
                  onClick={clearForm}
                  disabled={busy}
                >
                  清除欄位
                </Button>
              </div>
            </form>
          </>
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-900">
            {error}
          </p>
        )}
        <div role="status">
          {notice && <p className="rounded-xl bg-white/80 p-3">{notice}</p>}
        </div>
        {connected && (
          <section className="grid gap-3">
            <label className="grid gap-2 font-medium">
              搜尋歌單
              <Input
                className={inputStyle}
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="歌名或歌手"
              />
            </label>
            {visibleSongs.length === 0 && <p>找不到歌曲。</p>}
            <ul className="grid gap-2">
              {visibleSongs.map(song => (
                <li
                  key={song.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-100 bg-white/85 p-3"
                >
                  <div className="min-w-0 break-words">
                    <p className="font-bold">{song.title}</p>
                    <p className="text-sm text-amber-800">{song.artist}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className={secondaryStyle}
                      disabled={busy}
                      onClick={() => {
                        if (
                          (draft.title.trim() || draft.artist.trim()) &&
                          !window.confirm("要放棄欄位中尚未加入草稿的內容嗎？")
                        )
                          return;
                        setEditId(song.id);
                        setDraft({ title: song.title, artist: song.artist });
                        document
                          .querySelector<HTMLInputElement>("#song-form input")
                          ?.focus();
                      }}
                    >
                      編輯
                    </Button>
                    <Button
                      variant="outline"
                      className={secondaryStyle}
                      disabled={busy}
                      onClick={() => removeSong(song)}
                    >
                      移除
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
