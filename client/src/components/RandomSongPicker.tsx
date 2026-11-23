import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { songs, type Song } from "@/data/songs";

const allSongs = "";
const songArtists = new Map(
  songs.map(song => [
    song.id,
    song.artist
      .split(/[\/,&]/)
      .map(artist => artist.trim())
      .filter(Boolean),
  ])
);

interface Draw {
  song: Song;
  newRound: boolean;
}

interface DrawState {
  history: Map<string, Set<number>>;
  result: Draw | null;
}

export default function RandomSongPicker({ artists }: { artists: string[] }) {
  const [scope, setScope] = useState(allSongs);
  const [state, setState] = useState<DrawState>({
    history: new Map(),
    result: null,
  });
  const pool =
    scope === allSongs
      ? songs
      : songs.filter(song => songArtists.get(song.id)?.includes(scope));
  const { history, result } = state;
  const remaining = pool.length - (history.get(scope)?.size ?? 0);

  function drawSong() {
    if (pool.length === 0) return;
    const random = Math.random();
    setState(previous => {
      const drawn = previous.history.get(scope);
      const remainingSongs = pool.filter(song => !drawn?.has(song.id));
      const newRound = remainingSongs.length === 0;
      const candidates = newRound ? pool : remainingSongs;
      const song = candidates[Math.floor(random * candidates.length)];
      const nextDrawn = new Set(newRound ? undefined : drawn);
      nextDrawn.add(song.id);
      return {
        history: new Map(previous.history).set(scope, nextDrawn),
        result: { song, newRound },
      };
    });
  }

  return (
    <Dialog>
      <div className="mb-4 flex justify-center">
        <DialogTrigger asChild>
          <Button className="rounded-2xl bg-gradient-to-r from-yellow-200 to-yellow-300 px-8 py-6 text-lg font-bold text-yellow-900 shadow-lg hover:from-yellow-300 hover:to-yellow-400 motion-safe:hover:scale-105">
            🎲 隨機選歌
          </Button>
        </DialogTrigger>
      </div>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto rounded-2xl border-amber-100 bg-white p-0 text-amber-900 sm:max-w-md"
      >
        <header className="bg-gradient-to-r from-yellow-200 to-yellow-300 p-5 text-center">
          <DialogTitle className="text-2xl">🌙 隨機選歌 🧸</DialogTitle>
          <DialogDescription className="mt-2 text-amber-900">
            每個抽選範圍各自記錄，抽完會自動開始新一輪。
          </DialogDescription>
        </header>
        <div className="grid gap-4 p-4 sm:p-6">
          <label className="grid gap-1.5 text-sm font-semibold">
            抽選範圍
            <select
              value={scope}
              onChange={event => {
                setScope(event.target.value);
                setState(previous => ({ ...previous, result: null }));
              }}
              className="min-h-11 w-full rounded-xl border border-amber-200 bg-amber-50 px-3 text-base"
            >
              <option value={allSongs}>全部歌曲</option>
              {artists.map(artist => (
                <option key={artist} value={artist}>
                  {artist}
                </option>
              ))}
            </select>
          </label>
          <div
            aria-live="polite"
            aria-atomic="true"
            className="grid gap-2 text-center"
          >
            {result && (
              <div className="rounded-xl bg-amber-50 p-4 [overflow-wrap:anywhere]">
                <h3 className="text-2xl font-bold">{result.song.title}</h3>
                <p className="mt-1 text-amber-800">{result.song.artist}</p>
                <p className="mt-2 text-sm">
                  分類（歌手） {songArtists.get(result.song.id)?.join("、")}
                </p>
                {result.newRound && (
                  <p className="mt-2 text-sm">已開始新一輪</p>
                )}
              </div>
            )}
            <p className="text-sm text-amber-800">
              {pool.length === 0
                ? "這個分類目前沒有歌曲"
                : `本輪剩餘 ${remaining} / ${pool.length} 首`}
            </p>
          </div>
          <Button
            onClick={drawSong}
            disabled={pool.length === 0}
            className="min-h-11 w-full rounded-xl bg-yellow-300 font-bold text-yellow-900 hover:bg-yellow-400"
          >
            {result ? "🎲 再抽一首" : "🎲 抽一首"}
          </Button>
          <div className="flex flex-wrap justify-between gap-2">
            <Button
              variant="ghost"
              disabled={history.size === 0}
              onClick={() => setState({ history: new Map(), result: null })}
              className="min-h-11 text-amber-900 hover:bg-amber-50"
            >
              清除所有抽歌紀錄
            </Button>
            <DialogClose asChild>
              <Button
                variant="ghost"
                className="min-h-11 text-amber-900 hover:bg-amber-50"
              >
                關閉
              </Button>
            </DialogClose>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
