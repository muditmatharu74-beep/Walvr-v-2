"use client";

import { useEffect, useRef, useState } from "react";
import { clipTimelines, type ClipRange } from "@/lib/rendering/clip-timeline";

export default function ClipPreview() {
  const [file, setFile] = useState<File>();
  const [url, setUrl] = useState("");
  const [duration, setDuration] = useState(0);
  const [ranges, setRanges] = useState<ClipRange[]>([]);
  const [start, setStart] = useState("0");
  const [end, setEnd] = useState("30");
  const [editing, setEditing] = useState<number>();
  const [error, setError] = useState("");
  const player = useRef<HTMLAudioElement>(null);
  const stopAt = useRef<number | null>(null);

  useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const resetEditor = () => {
    setEditing(undefined);
    setStart("0");
    setEnd(String(Math.min(30, Math.floor(duration * 100) / 100)));
  };

  function save() {
    if (!start.trim() || !end.trim()) { setError("Enter both times."); return; }
    const next = ranges.slice();
    next[editing ?? next.length] = { startMs: Math.round(Number(start) * 1000), endMs: Math.round(Number(end) * 1000) };
    try {
      clipTimelines({ songDuration: duration, captions: [], beats: [] }, next);
      setRanges(next);
      resetEditor();
      setError("");
    } catch {
      setError("Choose a unique 20–35 second section within the track (up to three clips).");
    }
  }

  async function listen(range: ClipRange) {
    const audio = player.current;
    if (!audio) return;
    audio.currentTime = range.startMs / 1000;
    stopAt.current = range.endMs / 1000;
    try { await audio.play(); }
    catch { stopAt.current = null; setError("Playback couldn’t start. Try again."); }
  }

  return (
    <main style={{ maxWidth: 640, margin: "auto", padding: "2rem 1rem", display: "grid", gap: "1rem" }}>
      <h1>Choose your clips</h1>
      <p>Select and listen to up to three 20–35 second sections. This preview uses the file on your device and doesn’t create videos or charge credits.</p>
      <label>Audio file <input type="file" accept=".mp3,.m4a,.wav,.mp4" onChange={e => {
        player.current?.pause();
        stopAt.current = null;
        setDuration(0); setRanges([]); setUrl(""); setError("");
        setEditing(undefined); setStart("0"); setEnd("30");
        setFile(e.target.files?.[0]);
      }} /></label>
      {url && <audio key={url} ref={player} src={url} controls preload="metadata"
        onLoadedMetadata={e => {
          const seconds = e.currentTarget.duration;
          if (!Number.isFinite(seconds) || seconds < 20) {
            setError("Choose a playable track at least 20 seconds long.");
            return;
          }
          setDuration(seconds);
          setEnd(String(Math.min(30, Math.floor(seconds * 100) / 100)));
        }}
        onError={() => { setDuration(0); setError("This audio file couldn’t be played."); }}
        onTimeUpdate={e => {
          if (stopAt.current !== null && e.currentTarget.currentTime >= stopAt.current) {
            e.currentTarget.pause();
            e.currentTarget.currentTime = stopAt.current;
            stopAt.current = null;
          }
        }} />}
      {duration >= 20 && (ranges.length < 3 || editing !== undefined) && (
        <fieldset>
          <legend>{editing === undefined ? "Add section" : "Edit section"}</legend>
          <label>Start (seconds) <input type="number" min="0" step="0.01" value={start} onChange={e => setStart(e.target.value)} /></label>{" "}
          <label>End (seconds) <input type="number" min="20" step="0.01" value={end} onChange={e => setEnd(e.target.value)} /></label>{" "}
          <button type="button" onClick={save}>Save section</button>
          {editing !== undefined && <button type="button" onClick={resetEditor}>Cancel edit</button>}
        </fieldset>
      )}
      {error && <p role="alert">{error}</p>}
      <ol>{ranges.map((range, index) => (
        <li key={range.startMs + ":" + range.endMs}>
          {range.startMs / 1000}s–{range.endMs / 1000}s{" "}
          <button type="button" onClick={() => void listen(range)}>Listen</button>{" "}
          <button type="button" onClick={() => {
            setEditing(index); setStart(String(range.startMs / 1000)); setEnd(String(range.endMs / 1000));
          }}>Edit</button>{" "}
          <button type="button" onClick={() => {
            setRanges(ranges.filter((_, i) => i !== index)); resetEditor();
          }}>Remove</button>
        </li>
      ))}</ol>
    </main>
  );
}
