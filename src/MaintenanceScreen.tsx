import './maintenance.css'

const STATUS_LIGHTS = ['status-ok', 'status-warn', 'status-ok', 'status-alert']

export function MaintenanceScreen() {
  return (
    <main className="maintenance-screen" aria-labelledby="maintenance-title">
      <div className="maintenance-ambient" aria-hidden="true" />

      <section className="maintenance-hero">
        <p className="maintenance-badge">NSPE maintenance mode</p>

        <h1 id="maintenance-title">We&apos;re Upgrading the System</h1>
        <p className="maintenance-subtext">
          NSPE is performing scheduled enhancements. Please check back soon.
        </p>

        <div className="tech-scene" role="img" aria-label="Digital NSPE technician repairing a futuristic console">
          <div className="scene-grid" />

          <div className="console-shell">
            <div className="console-top">
              {STATUS_LIGHTS.map((lightClass, index) => (
                <span key={`${lightClass}-${index}`} className={`status-light ${lightClass}`} />
              ))}
            </div>
            <div className="console-display">
              <div className="display-line display-line-primary" />
              <div className="display-line" />
              <div className="display-line" />
              <div className="typing-cursor" />
            </div>
          </div>

          <div className="technician">
            <div className="tech-head" />
            <div className="tech-body">
              <div className="jacket-mark">NSPE</div>
            </div>
            <div className="tech-arm tech-arm-left" />
            <div className="tech-arm tech-arm-right" />
          </div>

          <div className="gear gear-large" />
          <div className="gear gear-small" />
        </div>

        <p className="maintenance-footer">System Engineer: NSPE Engine vNext</p>
      </section>
    </main>
  )
}
