"use client";

import { useState } from "react";
import InspectClient from "./InspectClient";

export default function PdfUploader() {
  const [pdfUrl, setPdfUrl] = useState(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
    }
  };

  return (
    <div className="p-4">
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFile}
        className="mb-4"
      />
      {pdfUrl ? (
        <InspectClient pdfUrl={pdfUrl} uuid="demo" />
      ) : (
        <p className="text-gray-500">Wybierz plik PDF żeby zobaczyć podgląd</p>
      )}
    </div>
  );
}
