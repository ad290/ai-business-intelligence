export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <p className="site-footer-text">
        © {year} Aditya Pawar. All rights reserved.
      </p>
    </footer>
  );
}
