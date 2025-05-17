
export default function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="bg-card border-t border-border mt-auto py-6 shadow-sm">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center text-muted-foreground">
        <p>&copy; {currentYear} TipSplit. All rights reserved.</p>
      </div>
    </footer>
  );
}
