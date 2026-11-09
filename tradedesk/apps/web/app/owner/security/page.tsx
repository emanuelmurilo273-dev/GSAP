import { Logo, Panel } from '@/components/ui';
import Security from './Security';

export default function Page() {
  return (
    <main className="mx-auto max-w-md px-4 py-6"><Logo />
      <div className="mt-6"><Panel title="segurança do dono · senha + 2FA" accent="#ff4fa3"><Security /></Panel></div>
    </main>
  );
}
