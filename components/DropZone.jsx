"use client";

import { useState, useCallback } from "react";

export default function DropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    setError("");
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    const isPdf = dropped.type === "application/pdf" || dropped.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Please drop a PDF file.");
      setFile(null);
      return;
    }
    setFile(dropped);
  }, []);

  const onPick = useCallback((e) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setError("");
    const isPdf = picked.type === "application/pdf" || picked.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Please choose a PDF file.");
      setFile(null);
      return;
    }
    setFile(picked);
  }, []);

  const openFileDialog = useCallback(() => {
    document.getElementById("file-upload")?.click();
  }, []);

  return (
    <div
      className={`w-full h-[500px] bg-white border-2 border-dashed flex items-center justify-center text-center px-4 rounded-xl transition-colors ${
        isDragging ? "border-[#2563eb] bg-[#f0f4ff]" : "border-[#808191]"
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      role="region"
      aria-label="PDF upload dropzone"
    >
      <div className="space-y-4">
        <p className="text-black text-lg">Drag & drop your PDF here</p>

        {/* Hidden file input */}
        <input
          id="file-upload"
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={onPick}
        />

        {/* Blue CTA */}
        <button
          type="button"
          onClick={openFileDialog}
          className="inline-block cursor-pointer rounded-md bg-[#2563eb] px-6 py-3 text-white font-semibold shadow hover:bg-[#1d4ed8] transition"
        >
          Click here to convert a PDF
        </button>

        {/* Preview / error */}
        {file && (
          <div className="text-sm text-black">
            Selected: <strong>{file.name}</strong>{" "}
            <span className="text-[#808191]">
              ({Math.round(file.size / 1024)} KB)
            </span>
          </div>
        )}
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>
    </div>
  );
}
