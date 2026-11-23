import songData from "./songs.json";

export interface Song {
  id: number;
  title: string;
  artist: string;
}

export const songs: Song[] = songData;
