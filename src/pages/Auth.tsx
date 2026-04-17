import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

export default function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) nav('/courses'); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (s) nav('/courses'); });
    return () => sub.subscription.unsubscribe();
  }, [nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/courses`,
          data: { display_name: displayName || email.split('@')[0] },
        },
      });
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success('Account created — you are signed in');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success('Welcome back');
    }
  };

  const onGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth('google', { redirect_uri: `${window.location.origin}/courses` });
    if (result.error) toast.error('Google sign-in failed');
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Link to="/" className="m-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Back to fretboard
      </Link>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-xl">
          <h1 className="text-2xl font-bold mb-1">Courses</h1>
          <p className="text-sm text-muted-foreground mb-6">{mode === 'signin' ? 'Sign in to access your shared course library.' : 'Create an account to publish lessons.'}</p>

          <form onSubmit={onSubmit} className="space-y-3">
            {mode === 'signup' && (
              <div>
                <Label htmlFor="name">Display name</Label>
                <Input id="name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Jane Educator" />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pw">Password</Label>
              <Input id="pw" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full">{loading ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}</Button>
          </form>

          <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> or <div className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={onGoogle}>Continue with Google</Button>

          <button
            type="button"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="mt-4 w-full text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
