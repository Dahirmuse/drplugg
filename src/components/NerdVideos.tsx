"use client";

import { useState } from "react";

export interface VideoItem {
  id: string;
  title: string;
  channel: string;
}

export interface VideoTopic {
  label: string;
  query: string;
}

export default function NerdVideos({
  videos,
  topics,
  chapterTitle,
}: {
  videos: VideoItem[];
  topics: VideoTopic[];
  chapterTitle: string;
}) {
  const [playing, setPlaying] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[--blue-light] border border-[--grey-light] p-4">
        <p className="text-sm font-semibold text-plum-dark flex items-center gap-2">
          ▶️ Ninja Nerd Medicine
        </p>
        <p className="mt-1 text-xs text-grey leading-relaxed">
          Lektioner som matchar <strong>{chapterTitle}</strong>. Titta för att bygga förståelse –
          men kom tillbaka och <em>återkalla</em> själv efteråt: videon får aldrig bli passivt tittande.
        </p>
      </div>

      {videos.length > 0 && (
        <div className="space-y-3">
          {videos.map((v) => (
            <div key={v.id} className="dp-card overflow-hidden">
              {playing === v.id ? (
                <div className="aspect-video w-full bg-black">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0`}
                    title={v.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="h-full w-full"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setPlaying(v.id)}
                  className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-[--grey-light]"
                >
                  <span className="relative flex-shrink-0 overflow-hidden rounded-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                      alt=""
                      className="h-16 w-28 object-cover"
                      loading="lazy"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
                      ▶
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-plum-dark">
                      {v.title}
                    </span>
                    <span className="block text-2xs text-grey">
                      {v.channel} · tryck för att spela här
                    </span>
                  </span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {topics.length > 0 && (
        <div>
          <p className="mb-2 text-2xs font-bold uppercase tracking-wider text-grey">
            Fler lektioner på Ninja Nerd
          </p>
          <div className="flex flex-wrap gap-2">
            {topics.map((t) => (
              <a
                key={t.query}
                href={`https://www.youtube.com/@NinjaNerdMedicine/search?query=${encodeURIComponent(t.query.replace(/^ninja nerd\s+/i, ""))}`}
                target="_blank"
                rel="noreferrer"
                className="dp-btn dp-btn-ghost text-xs"
              >
                🔎 {t.label.replace(/^Ninja Nerd:\s*/i, "")}
              </a>
            ))}
          </div>
        </div>
      )}

      {videos.length === 0 && topics.length === 0 && (
        <p className="text-sm text-grey">Inga videor kopplade till det här kapitlet ännu.</p>
      )}
    </div>
  );
}
