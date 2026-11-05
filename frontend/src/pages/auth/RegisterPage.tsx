import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, User, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Card } from '../../components/common/Card';

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password rule checks
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName || !email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!isPasswordValid) {
      setError('Password does not meet the complexity requirements.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({ fullName, email, password });
      navigate('/login');
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        err.message ||
        'Registration failed. Please check your information.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-navy-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-electric-600/15 blur-[120px] rounded-full pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <Link to="/" className="flex items-center justify-center gap-3 mb-6 group">
          <div className="p-2.5 rounded-xl bg-electric-600/20 text-electric-400 border border-electric-500/30 shadow-glow-purple group-hover:border-electric-400 transition-colors">
            <Shield className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold font-mono text-slate-100 tracking-wider">
            OBLIVION
          </span>
        </Link>
        <h2 className="text-center text-2xl font-bold tracking-tight text-white">
          Create Protected Account
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Already registered?{' '}
          <Link to="/login" className="font-medium text-electric-400 hover:text-electric-300">
            Sign in to existing account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0 relative z-10">
        <Card variant="glass" className="p-6 sm:p-8">
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/30 text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              placeholder="Eleanor Vance"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              leftIcon={<User className="w-4 h-4" />}
              autoComplete="name"
              required
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="eleanor@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              autoComplete="email"
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              autoComplete="new-password"
              required
            />

            {/* Password Requirement Checklist */}
            <div className="p-3 rounded-xl bg-navy-850/80 border border-navy-750 text-[11px] text-slate-400 space-y-1">
              <div className="font-semibold text-slate-300 mb-1">Security Criteria:</div>
              <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400' : ''}`}>
                <CheckCircle2 className="w-3.5 h-3.5" /> At least 8 characters
              </div>
              <div className={`flex items-center gap-1.5 ${hasUpper && hasLower ? 'text-emerald-400' : ''}`}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Uppercase and lowercase letters
              </div>
              <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400' : ''}`}>
                <CheckCircle2 className="w-3.5 h-3.5" /> At least one numerical digit
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isSubmitting}
                className="w-full"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Create Account
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-navy-800 text-center">
            <div className="text-[10px] text-slate-400">
              By registering, you agree that OBLIVION tracks and orchestrates your privacy removal
              requests. Your credentials are protected by bcrypt-12 hashing.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
