import { Logo, Panel } from '@/components/ui';
import OwnerLogin from './OwnerLogin';

export default function Page() {
  return (
    <main className="mx-auto max-w-md px-4 py-6"><Logo />
      <div className="mt-6"><Panel title="acesso do dono" accent="#ff4fa3"><OwnerLogin /></Panel></div>
    </main>
  );
}
