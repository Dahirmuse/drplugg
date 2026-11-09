import ninjaVideos from "@/content/ninja-nerd.json";

export type NinjaVideo = {
  id: string;
  title: string;
  channel: string;
};

const videos = ninjaVideos as Record<string, NinjaVideo[]>;

/** Verifierade Ninja Nerd-videor för ett kapitel (tomt om inget hittats). */
export function getNinjaVideos(chapterId: string): NinjaVideo[] {
  return videos[chapterId] ?? [];
}

export function ninjaChannelSearch(query: string): string {
  return `https://www.youtube.com/@NinjaNerdMedicine/search?query=${encodeURIComponent(query)}`;
}

export function youtubeSearch(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export function embedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
}
