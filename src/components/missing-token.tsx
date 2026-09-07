/** Shown wherever a controller-only page can't resolve a token from the URL or localStorage —
 * the history list/detail pages and the control page all hit this same dead end the same way. */
export function MissingToken() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-xl font-semibold">Missing controller token</h1>
      <p className="text-sm text-muted-foreground">
        Open this room using the controller link you received when you created it.
      </p>
    </main>
  )
}
