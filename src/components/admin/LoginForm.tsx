'use client';

import { useActionState, useState } from 'react';
import { Logo } from '@/components/brand/Logo';
import { login, type LoginState } from '@/lib/cms/actions';
import { LangSwitch, useAdmin } from './lang';
import { btn, inputDark } from './styles';

export function LoginForm() {
  const { t } = useAdmin();
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  return (
    <main className="relative grid min-h-dvh place-items-center bg-night px-6 text-bone">
      <LangSwitch className="absolute end-5 top-4 inline-flex min-h-tap items-center text-small text-bone-soft underline underline-offset-4 hover:text-bone" />
      <form action={action} className="w-full max-w-sm">
        <Logo className="h-12 w-auto" />
        <h1 className="mt-12 text-h4 font-medium">{t.appName}</h1>
        <p className="mt-2 text-small text-bone-soft">{t.login.intro}</p>
        <div className="mt-8 flex items-center justify-between">
          <label htmlFor="password" className="text-micro tracking-(--ls-eyebrow) text-bone-soft uppercase">
            {t.login.password}
          </label>
          <button type="button" onClick={() => setShow((s) => !s)} className="min-h-8 text-micro text-bone-soft underline underline-offset-4 hover:text-bone">
            {show ? t.login.hide : t.login.show}
          </button>
        </div>
        <input
          id="password"
          name="password"
          type={show ? 'text' : 'password'}
          dir="ltr"
          required
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={state.error ? true : undefined}
          className={`${inputDark} mt-2`}
        />
        {state.error && (
          <p role="alert" className="mt-3 text-small text-copper">
            {state.error}
          </p>
        )}
        <button type="submit" disabled={pending} className={`${btn.copper} mt-6 w-full`}>
          {pending ? t.login.submitting : t.login.submit}
        </button>
      </form>
    </main>
  );
}
