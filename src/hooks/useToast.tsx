import { useState } from 'react';

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const [tipo, setTipo] = useState<'ok' | 'erro'>('ok');

  const mostrar = (texto: string, t: 'ok' | 'erro' = 'ok') => {
    setMsg(texto);
    setTipo(t);
    window.clearTimeout((mostrar as unknown as { _t?: number })._t);
    (mostrar as unknown as { _t?: number })._t = window.setTimeout(() => setMsg(null), 4200);
  };

  const toast =
    msg === null ? null : (
      <div className={`toast ${tipo}`} role="status">
        {msg}
      </div>
    );

  return { toast, mostrar };
}
