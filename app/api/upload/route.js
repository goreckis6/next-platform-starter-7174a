"use client";

import { useCallback, useState } from "react";
import {
  ArrowUpTrayIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

export default function DropZone() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null); // { ok, key, url, filename, ... }

  const isPdf = (f) =>
    f?.type === "application/pdf" || f?.name?.toLowerCase().endsWith(".pdf");

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    setError("");
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    if (!isPdf(dropped)) {
      setError("Please select a PDF file.");
      setFile(null);
      return;
    }
    setFile(dropped);
    uploadFile(dropped);
  }, []);

  const openFileDialog = () => {
    document.getElementById("pdf-input")?.click();
  };

  const handlePick = (e) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setError("");
    if (!isPdf(picked)) {
      setError("Please select a PDF file.");
      setFile(null);
      return;
    }
    setFile(picked);
    uploadFile(picked);
  };

  // XHR -> /api/upload (Netlify Blobs) z progressem
  const uploadFile = (f) => {
    setUploading(true);
    setProgress(0);
    setResult(null);
    setError("");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      setUploading(false);
      try {
        const data = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300) {
          setResult(data);
        } else {
          setError(data?.error || "Upload failed.");
        }
      } catch {
        setError("Upload failed (invalid server response).");
      }
    };

    xhr.onerror = () => {
      setUploading(false);
      setError("Network error during upload.");
    };

    const form = new FormData();
    form.append("file", f);
    form.append("filename", f.name || "upload.pdf");
    xhr.send(form);
  };

  const sizeKb = file ? Math.max(1, Math.round(file.size / 1024)) : 0;

  return (
    <div
      className={`relative w-full h-[500px] rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition
        ${isDragging ? "border-[#2563eb]" : "border-gray-400"}
        bg-[#F1F0EF] hover:border-gray-600`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={openFileDialog} // cały box klikalny
      role="region"
      aria-label="PDF upload dropzone"
    >
      {/* Ukryty input */}
      <input
        id="pdf-input"
        type="file"
        accept="application/pdf"
        onChange={handlePick}
        className="hidden"
      />

      {/* Ikona */}
      <ArrowUpTrayIcon className="h-16 w-16 text-gray-700 mb-4 pointer-events-none" />

      {/* Tekst */}
      <div className="text-center mb-6 pointer-events-none">
        <p className="text-lg font-medium text-gray-800">
          Drag & drop your PDF here
        </p>
        <p className="text-sm text-gray-700">or click anywhere in the box</p>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openFileDialog();
        }}
        disabled={uploading}
        className={`rounded-md px-6 py-3 text-white font-semibold shadow transition
          ${uploading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
      >
        {uploading ? "Uploading…" : "Click here to convert a PDF"}
      </button>

      {/* Info o pliku */}
      {file && (
        <div className="mt-4 text-sm text-gray-900 flex items-center gap-2">
          <span className="font-medium">Selected:</span>
          <span className="truncate max-w-[60vw]">{file.name}</span>
          <span className="text-gray-600">({sizeKb} KB)</span>
        </div>
      )}

      {/* Pasek postępu */}
      {(uploading || progress > 0) && (
        <div className="mt-4 w-full max-w-xl px-6">
          <div className="w-full h-2 bg-white/60 rounded">
            <div
              className="h-2 rounded bg-blue-600 transition-[width]"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-gray-700">{progress}%</div>
        </div>
      )}

      {/* Wynik / błąd */}
      {result?.ok && result?.url && !error && !uploading && (
        <div
          className="mt-4 flex flex-col items-center gap-2 text-green-700"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-5 w-5" />
            <span>Uploaded successfully.</span>
          </div>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            View uploaded file
          </a>
        </div>
      )}

      {!!error && (
        <div className="mt-4 flex items-center gap-2 text-red-600" onClick={(e) => e.stopPropagation()}>
          <XCircleIcon className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Dalszy krok */}
      {result?.ok && !uploading && !error && (
        <a
          href="/dashboard"
          className="mt-4 inline-block rounded-md border border-blue-600 px-4 py-2 text-blue-600 hover:bg-blue-50 transition text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          Continue to conversion
        </a>
      )}
    </div>
  );
}
