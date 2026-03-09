'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface FieldErrors {
  username?: string;
  email?: string;
  password?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  function validateField(name: string, value: string): string {
    if (name === 'username') {
      if (value.length < 3 || value.length > 30) return 'Username must be 3–30 characters.';
      if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Only letters, numbers, and underscores allowed.';
    }
    if (name === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Enter a valid email address.';
    }
    if (name === 'password') {
      if (value.length < 8) return 'Minimum 8 characters.';
      if (!/[A-Z]/.test(value)) return 'Must include at least one uppercase letter.';
      if (!/[a-z]/.test(value)) return 'Must include at least one lowercase letter.';
      if (!/[0-9]/.test(value)) return 'Must include at least one number.';
    }
    return '';
  }

  function handleBlur(name: string, value: string) {
    const err = validateField(name, value);
    setFieldErrors((prev) => ({ ...prev, [name]: err || undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');

    const errors: FieldErrors = {};
    const uErr = validateField('username', username);
    const eErr = validateField('email', email);
    const pErr = validateField('password', password);
    if (uErr) errors.username = uErr;
    if (eErr) errors.email = eErr;
    if (pErr) errors.password = pErr;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // Check username uniqueness
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (existing) {
      setFieldErrors({ username: 'Username already taken.' });
      setLoading(false);
      return;
    }

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
      },
    });

    if (signUpError) {
      setServerError(signUpError.message);
      setLoading(false);
      return;
    }

    // Profile is created automatically by a database trigger (handle_new_user).
    // If email confirmation is enabled, authData.session is null — redirect to
    // a confirmation notice instead of the dashboard.
    if (authData.session) {
      router.push('/dashboard');
      router.refresh();
    } else {
      router.push('/login?message=check-email');
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-500 mb-3">
          <span className="text-2xl">🍜</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
        <p className="text-sm text-gray-500 mt-1">Set up your household MealMate account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
            Username
          </label>
          <input
            id="username"
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={(e) => handleBlur('username', e.target.value)}
            className={`w-full h-12 px-4 rounded-xl border bg-gray-50 focus:bg-white outline-none transition text-gray-900 placeholder-gray-400 ${
              fieldErrors.username
                ? 'border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                : 'border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100'
            }`}
            placeholder="your_username"
          />
          {fieldErrors.username && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.username}</p>
          )}
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email (for password recovery)
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={(e) => handleBlur('email', e.target.value)}
            className={`w-full h-12 px-4 rounded-xl border bg-gray-50 focus:bg-white outline-none transition text-gray-900 placeholder-gray-400 ${
              fieldErrors.email
                ? 'border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                : 'border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100'
            }`}
            placeholder="you@example.com"
          />
          {fieldErrors.email && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={(e) => handleBlur('password', e.target.value)}
            className={`w-full h-12 px-4 rounded-xl border bg-gray-50 focus:bg-white outline-none transition text-gray-900 placeholder-gray-400 ${
              fieldErrors.password
                ? 'border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                : 'border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-100'
            }`}
            placeholder="••••••••"
          />
          {password && (
            <ul className="mt-2 space-y-1">
              {[
                { label: 'At least 8 characters', met: password.length >= 8 },
                { label: 'At least one uppercase letter', met: /[A-Z]/.test(password) },
                { label: 'At least one lowercase letter', met: /[a-z]/.test(password) },
                { label: 'At least one number', met: /[0-9]/.test(password) },
              ].map(({ label, met }) => (
                <li key={label} className={`flex items-center gap-1.5 text-xs ${met ? 'text-green-600' : 'text-gray-400'}`}>
                  <span>{met ? '✓' : '○'}</span>
                  {label}
                </li>
              ))}
            </ul>
          )}
          {fieldErrors.password && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p>
          )}
        </div>

        {serverError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white font-semibold rounded-xl transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
        >
          {loading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-6">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Sign in
        </Link>
      </p>
    </div>
  );
}
