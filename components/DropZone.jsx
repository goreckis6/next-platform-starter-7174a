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

    if (dropped.type !== "application/pdf" && !dropped.name.toLowerCase().endsWith(".pdf")) {
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
    if (picked.type !== "application/pdf" && !picked.name.toLowerCase().endsWith(".pdf")) {
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
    <section
      className={`w-full h-[500px] bg-gray-50 border-2 border-dashed flex items-center justify-center text-center px-4
        ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      aria-label="PDF upload dropzone"
    >
      <div className="space-y-4">
        <p className="text-gray-600 text-lg">
          Drag & drop your PDF here
        </p>

        {/* Hidden file input */}
        <input
          id="file-upload"
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={onPick}
        />

        {/* Blue button */}
        <button
          type="button"
          onClick={openFileDialog}
          className="inline-block cursor-pointer rounded-md bg-blue-600 px-6 py-3 text-white font-semibold shadow hover:bg-blue-700 transition"
        >
          Click here to convert a PDF
        </button>

        {/* File preview / error */}
        {file && (
          <div className="text-sm text-gray-700">
            Selected: <strong>{file.name}</strong>{" "}
            <span className="text-gray-500">
              ({Math.round(file.size / 1024)} KB)
            </span>
          </div>
        )}
        {error && (
          <div className="text-sm text-red-600">{error}</div>
        )}

        {/* (Opcjonalnie) Akcja konwersji po wyborze */}
        {/* Możesz zamienić href na swoją stronę/przesłanie pliku */}
        {file && (
          <a
            href="/dashboard"
            className="inline-block rounded-md border border-blue-600 px-4 py-2 text-blue-600 hover:bg-blue-50 transition text-sm"
          >
            Continue to conversion
          </a>
        )}
      </div>
    </section>
  );
}
