import { PageHeader } from '../components/Layout';

export function ExtensionPage() {
  return (
    <>
      <PageHeader title="Chrome extension" subtitle="FormPilot lives in Chrome's side panel and works on ordinary websites." />
      <div className="stack" style={{ gap: 20 }}>
        <div className="card">
          <div className="card-head"><h2>Install</h2><a className="btn btn-primary" href="/formpilot-extension.zip" download>Download extension</a></div>
          <div className="card-body">
            <ol className="steps">
              <li><span>Download and unzip <span className="mono">formpilot-extension.zip</span>.</span></li>
              <li><span>Open <span className="mono">chrome://extensions</span> and switch on <strong>Developer mode</strong> (top right).</span></li>
              <li><span>Click <strong>Load unpacked</strong> and choose the unzipped folder.</span></li>
              <li><span>Pin FormPilot from the puzzle-piece menu, click it, and sign in with this account.</span></li>
            </ol>
            <p className="subtle" style={{ marginTop: 16 }}>The extension is preconfigured for this site. Chrome Web Store listing comes after the MVP.</p>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h2>Try it</h2><a className="btn" href="/demo/" target="_blank" rel="noopener">Open demo form</a></div>
          <div className="card-body stack" style={{ gap: 10 }}>
            <p className="muted">On any page with a form: click the FormPilot icon → <strong>Scan page</strong> → review the answers → <strong>Approve all</strong> or approve one by one → <strong>Fill form</strong>. Check the page and submit it yourself — FormPilot never submits.</p>
            <p className="subtle">Works with standard inputs, textareas, dropdowns, checkboxes and radio buttons, including React/Vue-controlled forms. Not yet supported: fully custom widgets (e.g. Google Forms' styled dropdowns), forms inside cross-origin iframes, and file uploads.</p>
          </div>
        </div>
      </div>
    </>
  );
}
