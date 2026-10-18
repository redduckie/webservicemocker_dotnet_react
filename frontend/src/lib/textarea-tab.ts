import type { Dispatch, KeyboardEvent, SetStateAction } from "react";

const INDENT = "  ";

interface TabEdit {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export function applyTextareaTab(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  unindent: boolean
): TabEdit {
  if (!unindent && selectionStart === selectionEnd) {
    return {
      value: value.slice(0, selectionStart) + INDENT + value.slice(selectionEnd),
      selectionStart: selectionStart + INDENT.length,
      selectionEnd: selectionStart + INDENT.length,
    };
  }

  const lineStart = value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
  if (unindent && selectionStart === selectionEnd) {
    const nextLineBreak = value.indexOf("\n", selectionStart);
    const lineEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
    const line = value.slice(lineStart, lineEnd);
    const removed = line.startsWith(INDENT) ? INDENT.length : line.startsWith(" ") ? 1 : 0;
    const nextCursor = Math.max(lineStart, selectionStart - Math.min(removed, selectionStart - lineStart));
    return {
      value: value.slice(0, lineStart) + line.slice(removed) + value.slice(lineEnd),
      selectionStart: nextCursor,
      selectionEnd: nextCursor,
    };
  }

  const selectedBlock = value.slice(lineStart, selectionEnd);
  const lines = selectedBlock.split("\n");

  if (!unindent) {
    const replacement = lines.map((line) => INDENT + line).join("\n");
    return {
      value: value.slice(0, lineStart) + replacement + value.slice(selectionEnd),
      selectionStart: selectionStart + INDENT.length,
      selectionEnd: selectionEnd + INDENT.length * lines.length,
    };
  }

  const removedPerLine = lines.map((line) => line.startsWith(INDENT) ? INDENT.length : line.startsWith(" ") ? 1 : 0);
  const replacement = lines.map((line, index) => line.slice(removedPerLine[index])).join("\n");
  const removedBeforeStart = Math.min(removedPerLine[0], selectionStart - lineStart);
  const totalRemoved = removedPerLine.reduce((total, count) => total + count, 0);

  return {
    value: value.slice(0, lineStart) + replacement + value.slice(selectionEnd),
    selectionStart: selectionStart - removedBeforeStart,
    selectionEnd: Math.max(selectionStart - removedBeforeStart, selectionEnd - totalRemoved),
  };
}

export function handleTextareaTab(
  event: KeyboardEvent<HTMLTextAreaElement>,
  setValue: Dispatch<SetStateAction<string>>
): void {
  if (event.key !== "Tab") return;
  event.preventDefault();

  const textarea = event.currentTarget;
  const edit = applyTextareaTab(
    textarea.value,
    textarea.selectionStart,
    textarea.selectionEnd,
    event.shiftKey
  );
  setValue(edit.value);

  requestAnimationFrame(() => {
    textarea.setSelectionRange(edit.selectionStart, edit.selectionEnd);
  });
}
