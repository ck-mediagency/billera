export default function MoneyCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div
      className="card"
      style={{
        padding: 14,
      }}
    >
      <div
        className="text-muted"
        style={{
          fontSize: 12,
          marginBottom: 6,
          fontWeight: 600,
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: 20,
          fontWeight: 900,
          marginBottom: subtitle ? 6 : 0,
          color: "var(--text)",
        }}
      >
        {value}
      </div>

      {subtitle ? (
        <div className="text-muted" style={{ fontSize: 12 }}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}
