export interface TextContext {
  editable: boolean;
  disabled: boolean;
  readOnly: boolean;
  sensitive: boolean;
  noCopy: boolean;
  selectedText: string;
  hasText: boolean;
}

/** The shared menu must respect readonly fields and the vault's own Copy buttons. */
export function textActions(context: TextContext) {
  const copy = !context.disabled && !context.sensitive && !context.noCopy && !!context.selectedText;
  return {
    copy,
    cut: copy && context.editable && !context.readOnly,
    paste: context.editable && !context.disabled && !context.readOnly,
    selectAll: context.editable && !context.disabled && context.hasText,
  };
}

/** Keep the entire menu inside the window, including keyboard-opened menus. */
export function menuPosition(x: number, y: number, width: number, height: number, viewportWidth: number, viewportHeight: number) {
  const edge = 8;
  return {
    left: Math.max(edge, Math.min(x, viewportWidth - width - edge)),
    top: Math.max(edge, Math.min(y, viewportHeight - height - edge)),
  };
}
