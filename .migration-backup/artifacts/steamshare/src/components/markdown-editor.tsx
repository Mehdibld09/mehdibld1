import { useRef } from "react";
import { Bold, Italic, Underline, Link } from "lucide-react";

interface MarkdownEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  rows?: number;
}

function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  onChange: (val: string) => void
) {
  const { selectionStart: s, selectionEnd: e, value } = textarea;
  const selected = value.substring(s, e) || "text";
  const newVal = value.substring(0, s) + before + selected + after + value.substring(e);
  onChange(newVal);
  setTimeout(() => {
    textarea.focus();
    textarea.setSelectionRange(s + before.length, s + before.length + selected.length);
  }, 0);
}

function insertLink(
  textarea: HTMLTextAreaElement,
  onChange: (val: string) => void
) {
  const { selectionStart: s, selectionEnd: e, value } = textarea;
  const selected = value.substring(s, e) || "link text";
  const url = prompt("Enter URL:", "https://");
  if (!url) return;
  const inserted = `[${selected}](${url})`;
  const newVal = value.substring(0, s) + inserted + value.substring(e);
  onChange(newVal);
  setTimeout(() => textarea.focus(), 0);
}

export function MarkdownEditor({ value, onChange, placeholder, className, rows = 4 }: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const btn = (title: string, icon: React.ReactNode, action: () => void) => (
    <button
      type="button"
      title={title}
      onClick={action}
      className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
    >
      {icon}
    </button>
  );

  return (
    <div className="border border-border rounded-lg overflow-hidden focus-within:ring-1 focus-within:ring-ring">
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border bg-muted/30">
        {btn("Bold (**text**)", <Bold className="h-3.5 w-3.5" />, () => {
          if (textareaRef.current) wrapSelection(textareaRef.current, "**", "**", onChange);
        })}
        {btn("Italic (_text_)", <Italic className="h-3.5 w-3.5" />, () => {
          if (textareaRef.current) wrapSelection(textareaRef.current, "_", "_", onChange);
        })}
        {btn("Underline (__text__)", <Underline className="h-3.5 w-3.5" />, () => {
          if (textareaRef.current) wrapSelection(textareaRef.current, "__", "__", onChange);
        })}
        {btn("Link [text](url)", <Link className="h-3.5 w-3.5" />, () => {
          if (textareaRef.current) insertLink(textareaRef.current, onChange);
        })}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`w-full bg-background px-3 py-2 text-sm resize-none focus:outline-none ${className ?? ""}`}
      />
    </div>
  );
}
