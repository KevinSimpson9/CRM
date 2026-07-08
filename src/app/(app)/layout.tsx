import Nav from "@/components/Nav";
import GlobalHotkeys from "@/components/GlobalHotkeys";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <GlobalHotkeys />
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </>
  );
}
