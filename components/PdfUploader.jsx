// components/PdfUploader.jsx
"use client";

import { useState } from "react";
import InspectClient from "./InspectClient";

export default function PdfUploader() {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfData, setPdfData] = useState(null); // ArrayBuffer

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // akceptuj też przypadek, gdy mime nie jest ustawione
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      alert("Wybierz plik PDF.");
      return;
    }

    // URL blob – działa często, ale nie wszędzie
    const url = URL.createObjectURL(file);
    setPdfUrl(url);

    // ArrayBuffer – bardziej niezawodny dla pdfjs
    const buf = await file.arrayBuffer();
    setPdfData(buf);
  };

  return (
    <div className="p-0">
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFile}
        className="mb-4"
      />

      {pdfUrl || pdfData ? (
        <InspectClient
          key={pdfUrl || (pdfData && `buf-${(pdfData.byteLength || 0)}`)}
          pdfUrl={pdfUrl}
          pdfData={pdfData}
          uuid="local"
        />
      ) : (
        <p className="text-gray-500">
          Wybierz plik PDF, aby zobaczyć podgląd.
        </p>
      )}
    </div>
  );
}
