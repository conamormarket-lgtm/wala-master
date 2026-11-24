export function detailVideoPlayback(media = {}) {
  const autoPlay = media.autoPlay === true;
  return { autoPlay, muted: autoPlay || media.muted === true, loop: media.loop === true };
}

// Silent automatic clips can coexist; manually played videos keep one soundtrack.
export function pauseCompetingDetailVideos(current) {
  if (current.autoplay && current.muted) return;
  current.closest('[data-componente="ComposicionDetalles"]')?.querySelectorAll('video').forEach(video => {
    if (video !== current && !(video.autoplay && video.muted)) video.pause();
  });
}
