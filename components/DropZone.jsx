"use client";

import { useCallback } from "react";
import { ArrowUpTrayIcon } from "@heroicons/react/24/outline"; // ikona uploadu

export default function DropZone() {
  const handleDrop = useCallback((event) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      console.log("Dropped file:", files[0]);
      // TODO: obsłuż upload / konwersję
    }
  }, []);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      console.log("Selected file:", file);
      // TODO: obsłuż upload / konwersję
    }
  };

  const handleClick = () => {
    document.getElementById("fileInput").click();
  };

  return (
    <div
      className="relative w-full h-[500px] rounded-lg border-2 border-dashed border-gray-400 flex flex-col items-center justify-center cursor-pointer bg-[#F1F0EF] transition hover:border-gray-600"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onClick={handleClick} // cały box klikalny
    >
      <input
        id="fileInput"
        type="file"
        accept="application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Ikona uploadu */}
      <ArrowUpTrayIcon className="h-16 w-16 text-gray-600 mb-6" />

      <p className="text-lg font-medium text-gray-700 mb-6 text-center">
        Drag & drop your PDF here <br /> or click anywhere in the box
      </p>

      <button
        type="button"
        className="rounded-md bg-blue-600 px-6 py-3 text-white font-semibold shadow hover:bg-blue-700 transition"
      >
        Click here to convert a PDF
      </button>
    </div>
  );
}
