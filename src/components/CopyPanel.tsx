import { useState } from "react";

type CopyPanelProps = {
  title: string;
  description: string;
  text: string;
  accent?: boolean;
};

export default function CopyPanel({ title, description, text, accent = false }: CopyPanelProps) {
  const [copied, setCopied] = useState(false);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.append(textArea);
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <article className={`copy-panel${accent ? " copy-panel--accent" : ""}`}>
      <div className="copy-panel-heading">
        <div><h3>{title}</h3><p>{description}</p></div>
        <button className="copy-button" onClick={() => void copyText()}>{copied ? "Copied" : "Copy"}</button>
      </div>
      <pre>{text}</pre>
    </article>
  );
}
