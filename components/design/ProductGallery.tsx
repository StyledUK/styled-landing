"use client";

import { useRef, useState } from "react";
import type { CatalogueItem } from "@/lib/types";

type Props = {
  item: CatalogueItem;
  view: "catalogue" | "details" | "supplier";
  onOpen?: () => void;
};

export default function ProductGallery({ item, view, onOpen }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const photos = [...(item.image ? [{ src: item.image, alt: item.name }] : []), ...(item.gallery || [])]
    .filter((photo, i, all) => photo.src && all.findIndex(other => other.src === photo.src) === i);
  const multiple = photos.length > 1;
  const ratio = view === "catalogue" ? "aspect-[16/10]" : "aspect-[4/3]";
  const fit = view === "details" || item.demoOnly || item.imageKind === "supplier_reference"
    ? "object-contain p-3" : "object-contain sm:object-cover";

  function show(next: number) {
    const el = track.current;
    if (el) el.scrollTo({ left: next * el.clientWidth, behavior: "instant" });
  }

  return <div className="relative min-w-0 overflow-hidden bg-cream" role="group" aria-label={item.name + " photos"}>
    <div ref={track} className={multiple ? "flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : "flex"}
      tabIndex={multiple ? 0 : undefined}
      onScroll={event => {
        const el = event.currentTarget;
        if (el.clientWidth) setIndex(Math.max(0, Math.min(photos.length - 1, Math.round(el.scrollLeft / el.clientWidth))));
      }}
      onKeyDown={event => {
        if (multiple && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
          event.preventDefault();
          show(Math.max(0, Math.min(photos.length - 1, index + (event.key === "ArrowRight" ? 1 : -1))));
        }
      }}>
      {photos.length ? photos.map((photo, i) => {
        const image = <img src={photo.src} alt={photo.alt} loading={view === "details" && i === 0 ? "eager" : "lazy"} className={ratio + " w-full " + fit} />;
        const slide = "block w-full shrink-0 snap-start";
        if (onOpen) return <button key={photo.src} type="button" tabIndex={i === index ? 0 : -1} className={slide} onClick={onOpen} aria-label={`View ${item.name} details`}>{image}</button>;
        if (view === "details") return <a key={photo.src} className={slide} tabIndex={i === index ? 0 : -1} href={photo.src} target="_blank" rel="noreferrer" aria-label={photo.alt + ", open full photo"}>{image}</a>;
        return <div key={photo.src} className={slide}>{image}</div>;
      }) : <div className={ratio + " flex w-full flex-col items-center justify-center gap-2"}>
        {onOpen ? <button type="button" onClick={onOpen} aria-label={`View ${item.name} details`} className="h-full w-full text-4xl">{item.icon}</button> : <span className="text-4xl">{item.icon}</span>}
        {view === "details" && <span className="text-sm">Photo not supplied</span>}
      </div>}
    </div>
    {multiple && <div className="flex items-center justify-center gap-2 bg-white text-sm">
      <button type="button" aria-label="Previous photo" disabled={index === 0} onClick={() => show(index - 1)} className="h-11 w-11 disabled:opacity-30">←</button>
      <span aria-live="polite" aria-atomic="true" className="tabular-nums">{index + 1} / {photos.length}</span>
      <button type="button" aria-label="Next photo" disabled={index === photos.length - 1} onClick={() => show(index + 1)} className="h-11 w-11 disabled:opacity-30">→</button>
    </div>}
  </div>;
}
