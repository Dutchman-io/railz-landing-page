/* eslint-disable @next/next/no-html-link-for-pages -- marketing pages link with plain <a> on purpose: home.css and doc.css reuse selectors, so each page must arrive on a full load with only its own stylesheet (see site.css). */
/* Masthead of the document pages (careers, privacy, terms, delete account). */
export function DocHeader({ tile = true }: { tile?: boolean }) {
  return (
    <div className="wrap">
      <header className="mast">
        <a className="brand" href="/">
          {tile && (
            <span className="tile">
              {/* eslint-disable-next-line @next/next/no-img-element -- static 224px brand tile, kept as a plain <img> to match the old page */}
              <img src="/logo.png" alt="" />
            </span>
          )}
          <span className="word">
            Zem<b>Fi</b>
          </span>
        </a>
        <a className="back" href="/">
          &larr; Back to home
        </a>
      </header>
    </div>
  );
}
