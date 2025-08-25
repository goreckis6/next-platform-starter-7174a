// components/PdfUploader.jsx
"use client";

import { useState } from "react";
import InspectClient from "./InspectClient";

export default function PdfUploader() {
  const [pdfUrl, setPdfUrl] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      alert("Wybierz plik PDF.");
      return;
    }
    const url = URL.createObjectURL(file);
    setPdfUrl(url);
  };

  return (
    <div className="p-0">
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFile}
        className="mb-4"
      />
      {pdfUrl ? (
        <InspectClient pdfUrl={pdfUrl} uuid="local" />
      ) : (
        <p className="text-gray-500">Wybierz plik PDF, aby zobaczyć podgląd.</p>
      )}
    </div>
  );
}
