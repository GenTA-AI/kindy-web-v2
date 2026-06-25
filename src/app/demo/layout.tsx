export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <style>{`body > footer { display: none !important; }`}</style>
    </>
  );
}
