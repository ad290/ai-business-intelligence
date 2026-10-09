type AppPageHeaderProps = {
  title: string;
  subtitle: string;
};

export function AppPageHeader({ title, subtitle }: AppPageHeaderProps) {
  return (
    <header className="app-page-header page-card">
      <h1>{title}</h1>
      <p className="muted app-page-subtitle">{subtitle}</p>
    </header>
  );
}
