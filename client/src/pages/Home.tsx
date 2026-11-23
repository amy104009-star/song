import { useState, useEffect, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { songs } from "@/data/songs";
import { Copy } from "lucide-react";
import RandomSongPicker from "@/components/RandomSongPicker";

/**
 * Design Philosophy: Warm, playful aesthetic with yellow background
 * - Soft yellow palette inspired by pastel textures
 * - Falling moon (🌙) and teddy bear (🧸) with multiple animation styles
 * - Clean, minimal song list with search functionality
 * - Artist filtering buttons for easy discovery
 * - Responsive layout for all screen sizes
 */

interface FallingBubble {
  id: string;
  emoji: string;
  left: number;
  duration: number;
  delay: number;
  size: number;
  animationType: "floatUp" | "floatUpSway" | "floatUpLeft";
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [bubbles, setBubbles] = useState<FallingBubble[]>([]);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Generate falling bubbles on mount
  useEffect(() => {
    const newBubbles: FallingBubble[] = [];
    const emojis = ["🌙", "🧸"];
    const animationTypes: Array<"floatUp" | "floatUpSway" | "floatUpLeft"> = [
      "floatUp",
      "floatUpSway",
      "floatUpLeft",
    ];

    // Create multiple falling items
    for (let i = 0; i < 25; i++) {
      newBubbles.push({
        id: `bubble-${i}`,
        emoji: emojis[i % 2],
        left: Math.random() * 100,
        duration: 12 + Math.random() * 11, // 12-23 seconds
        delay: Math.random() * 18, // 0-18 seconds
        size: 0.8 + Math.random() * 1.5, // 0.8-2.3 rem
        animationType: animationTypes[Math.floor(Math.random() * 3)],
      });
    }

    setBubbles(newBubbles);
  }, []);

  // Get unique artists sorted by count
  const artistCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    songs.forEach((song) => {
      // 支援多種分隔符號：/ , &
      const artists = song.artist.split(/[\/\,\&]/);
      artists.forEach((artist) => {
        const trimmed = artist.trim();
        if (trimmed) {
          counts[trimmed] = (counts[trimmed] || 0) + 1;
        }
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([artist]) => artist);
  }, []);

  // Filter songs based on search query and selected artist
  const filteredSongs = useMemo(() => {
    let result = songs;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (song) =>
          song.title.toLowerCase().includes(query) ||
          song.artist.toLowerCase().includes(query)
      );
    }

    // Filter by selected artist
    if (selectedArtist) {
      result = result.filter((song) =>
        song.artist.includes(selectedArtist)
      );
    }

    return result;
  }, [searchQuery, selectedArtist]);

  // Copy song info to clipboard
  const handleCopySong = (song: typeof songs[0]) => {
    const text = `${song.title} - ${song.artist}`;
    navigator.clipboard.writeText(text);
    setCopiedId(song.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, #FFF8DC 0%, #FFFACD 50%, #FFE4B5 100%)",
      }}
    >
      {/* Falling decorative bubbles */}
      <div className="bubbles-container fixed inset-0 pointer-events-none">
        {bubbles.map((bubble) => (
          <div
            key={bubble.id}
            className={`bubble ${bubble.animationType}`}
            style={{
              left: `${bubble.left}%`,
              fontSize: `${bubble.size}rem`,
              animation: `${bubble.animationType} ${bubble.duration}s linear ${bubble.delay}s infinite`,
            }}
          >
            {bubble.emoji}
          </div>
        ))}
      </div>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="pt-8 pb-4 text-center">
          <div className="flex items-center justify-center gap-4 mb-2">
            <span className="text-4xl md:text-5xl animate-sway">🌙</span>
            <h1 className="text-5xl md:text-6xl font-bold text-amber-900">
              璃璃歌單
            </h1>
            <span className="text-4xl md:text-5xl animate-sway">🧸</span>
          </div>
          <div className="h-1 w-24 bg-gradient-to-r from-amber-400 to-amber-300 mx-auto rounded-full mb-6"></div>

          <RandomSongPicker artists={artistCounts} />
          <a href="?admin" className="text-sm font-medium text-amber-900 underline underline-offset-4">管理歌單</a>
        </header>

        {/* Content container */}
        <main className="flex-1 container max-w-6xl mx-auto px-4 pb-12">
          {/* Search bar */}
          <div className="mb-6 max-w-4xl mx-auto">
            <div className="relative">
              <Input
                type="text"
                placeholder="搜尋歌曲或歌手..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border-2 border-amber-200 bg-white/80 backdrop-blur-sm text-amber-900 placeholder-amber-400 focus:border-amber-400 focus:outline-none transition-colors"
              />
              <svg
                className="absolute right-3 top-3.5 w-5 h-5 text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Artist filter section */}
          <div className="mb-8 max-w-4xl mx-auto">
            <h2 className="text-lg font-semibold text-amber-900 mb-3">
              🎤 歌手
            </h2>
            <div className="flex flex-wrap gap-2">
              {artistCounts.map((artist) => {
                const count = songs.filter((s) =>
                  s.artist.includes(artist)
                ).length;
                const isSelected = selectedArtist === artist;
                return (
                  <button
                    key={artist}
                    onClick={() =>
                      setSelectedArtist(isSelected ? null : artist)
                    }
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                      isSelected
                        ? "bg-yellow-400 text-yellow-900 shadow-md"
                        : "bg-white/60 hover:bg-white/80 text-yellow-900 border border-yellow-100"
                    }`}
                  >
                    {artist} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Song count */}
          <div className="text-center mb-6">
            <p className="text-amber-800 font-medium">
              共 {filteredSongs.length} 首歌曲
            </p>
          </div>

          {/* Song list - Updated to 2 columns on mobile, 4 on large screens */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {filteredSongs.length > 0 ? (
              filteredSongs.map((song) => (
                <div
                  key={song.id}
                  className="bg-white/70 backdrop-blur-sm rounded-xl p-2 sm:p-3 border border-amber-100 hover:border-amber-300 hover:shadow-md transition-all group flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-1 sm:gap-2 mb-1 sm:mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-amber-900 truncate text-[12px] sm:text-sm group-hover:text-amber-600 transition-colors">
                        {song.title}
                      </h3>
                      <p className="text-[10px] sm:text-[11px] text-amber-700 truncate">
                        {song.artist}
                      </p>
                    </div>
                    <button
                      onClick={() => handleCopySong(song)}
                      className="flex-shrink-0 p-1 sm:p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 transition-colors"
                      title="複製歌名"
                    >
                      {copiedId === song.id ? (
                        <span className="text-[10px] sm:text-xs">✓</span>
                      ) : (
                        <Copy className="w-2.5 h-2.5 sm:w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-amber-700 text-lg">
                  找不到符合的歌曲 😢
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
