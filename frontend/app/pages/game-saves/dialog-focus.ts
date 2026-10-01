/** Keep keyboard navigation inside these dialogs and return to the trigger. */
export function dialogFocus(element: HTMLElement) {
  const previous = document.activeElement;
  function keydown(event: KeyboardEvent) {
    if (event.key !== "Tab" || event.defaultPrevented) return;
    const controls = [...element.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), a[href], select:not(:disabled), textarea:not(:disabled), [tabindex='0']")]
      .filter((control) => control.getClientRects().length > 0 && !control.closest("[inert]"));
    if (!controls.length) { event.preventDefault(); element.focus(); return; }
    const index = controls.indexOf(document.activeElement as HTMLElement);
    if (index < 0 || (event.shiftKey && index === 0) || (!event.shiftKey && index === controls.length - 1)) {
      event.preventDefault();
      controls[event.shiftKey ? controls.length - 1 : 0].focus();
    }
  }
  element.addEventListener("keydown", keydown);
  return () => {
    element.removeEventListener("keydown", keydown);
    if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
  };
}
