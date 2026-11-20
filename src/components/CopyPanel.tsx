import { useState } from "react";
import { copyText } from "../clipboard";

type CopyPanelProps = {
  title: string;
  description: string;
  text: string;
  accent?: boolean;
};

export default function CopyPanel({ title, description, text, accent = false }: CopyPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <article className={`copy-panel${accent ? " copy-panel--accent" : ""}`}>
      <div className="copy-panel-heading">
        <div><h3>{title}</h3><p>{description}</p></div>
        <button className="copy-button" onClick={() => void handleCopy()}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <pre>{text}</pre>
    </article>
  );
}
