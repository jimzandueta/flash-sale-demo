type DisplayNameGateProps = {
  displayName: string;
  isSubmitting: boolean;
  onDisplayNameChange: (value: string) => void;
  onSubmit: () => void;
};

export function DisplayNameGate({
  displayName,
  isSubmitting,
  onDisplayNameChange,
  onSubmit
}: DisplayNameGateProps) {
  return (
    <section style={gateShell}>
      <div style={gateCopy}>
        <span style={eyebrow}>Launch window</span>
        <h1 style={headline}>Flash Sale Control Room</h1>
        <p style={lede}>Enter a display name to mint an anonymous session and step into the active sale floor.</p>
      </div>

      <form
        style={formCard}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label htmlFor="display-name" style={label}>
          Display name
        </label>
        <input
          id="display-name"
          name="display-name"
          value={displayName}
          onChange={(event) => onDisplayNameChange(event.target.value)}
          placeholder="Jim"
          style={input}
          disabled={isSubmitting}
        />
        <button type="submit" style={button} disabled={isSubmitting || displayName.trim().length === 0}>
          {isSubmitting ? 'Minting session...' : 'Start shopping'}
        </button>
      </form>
    </section>
  );
}

const gateShell: React.CSSProperties = {
  minHeight: '100vh',
  display: 'grid',
  gap: '2rem',
  alignItems: 'center',
  gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 420px)',
  padding: 'clamp(1.5rem, 4vw, 4rem)',
  background: 'radial-gradient(circle at top left, #ffe2b8 0%, #f7efe4 35%, #d9ecff 100%)',
  fontFamily: 'Avenir Next, Trebuchet MS, sans-serif'
};

const gateCopy: React.CSSProperties = {
  maxWidth: '38rem',
  color: '#18242f'
};

const eyebrow: React.CSSProperties = {
  display: 'inline-flex',
  padding: '0.35rem 0.8rem',
  borderRadius: '999px',
  background: '#102a43',
  color: '#f7efe4',
  fontSize: '0.78rem',
  letterSpacing: '0.12em',
  textTransform: 'uppercase'
};

const headline: React.CSSProperties = {
  margin: '1.25rem 0 0.75rem',
  fontSize: 'clamp(2.8rem, 7vw, 5.5rem)',
  lineHeight: 0.95,
  letterSpacing: '-0.05em'
};

const lede: React.CSSProperties = {
  margin: 0,
  maxWidth: '32rem',
  color: '#365166',
  fontSize: '1.05rem',
  lineHeight: 1.6
};

const formCard: React.CSSProperties = {
  display: 'grid',
  gap: '0.9rem',
  padding: '1.5rem',
  borderRadius: '1.5rem',
  background: 'rgba(255, 255, 255, 0.74)',
  boxShadow: '0 25px 60px rgba(16, 42, 67, 0.12)',
  border: '1px solid rgba(16, 42, 67, 0.08)'
};

const label: React.CSSProperties = {
  fontWeight: 700,
  color: '#18242f'
};

const input: React.CSSProperties = {
  width: '100%',
  border: '1px solid rgba(16, 42, 67, 0.15)',
  borderRadius: '0.9rem',
  padding: '0.95rem 1rem',
  fontSize: '1rem',
  background: '#fffdf9'
};

const button: React.CSSProperties = {
  border: 'none',
  borderRadius: '999px',
  padding: '0.95rem 1.1rem',
  fontSize: '1rem',
  fontWeight: 700,
  cursor: 'pointer',
  background: '#d6452f',
  color: '#fffaf3'
};