/** Open a blank tab during the user click (before async work) to avoid popup blockers. */
export function preOpenBrowserTab(): Window | null {
  return window.open('about:blank', '_blank', 'noopener,noreferrer')
}

export function navigateBrowserTab(tab: Window | null | undefined, url: string): void {
  if (tab && !tab.closed) {
    tab.location.href = url
    return
  }

  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  if (!opened) {
    throw new Error('Pop-up blocked. Allow pop-ups to open the attachment.')
  }
}

export function closeBrowserTab(tab: Window | null | undefined): void {
  if (tab && !tab.closed) {
    tab.close()
  }
}
