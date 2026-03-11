import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export default function TenantLogin() {
    const navigate = useNavigate();
    const { signIn, signUp, profile } = useAuth();
    const [tab, setTab] = useState('signin');

    // While auth + linking is in flight, suppress auto-redirect so we can control timing
    const isProcessing = useRef(false);

    // Sign In state
    const [signInData, setSignInData] = useState({ email: '', password: '' });
    const [signInError, setSignInError] = useState('');
    const [signInLoading, setSignInLoading] = useState(false);

    // Register state
    const [regData, setRegData] = useState({ fullName: '', email: '', password: '', contact: '' });
    const [regError, setRegError] = useState('');
    const [regSuccess, setRegSuccess] = useState(false);
    const [regLoading, setRegLoading] = useState(false);

    // Auto-redirect when profile is ready AND we are not mid-processing
    if (profile && !isProcessing.current) {
        if (profile.role === 'tenant') navigate('/tenant/dashboard', { replace: true });
        else if (profile.role === 'landlord') navigate('/landlord/dashboard', { replace: true });
    }

    const handleSignIn = async (e) => {
        e.preventDefault();
        setSignInError('');
        setSignInLoading(true);
        isProcessing.current = true; // block auto-redirect while we link
        try {
            const { data } = await signIn(signInData);
            const userId = data?.user?.id;

            // If there's a pending contact (first sign-in after email confirmation), link now
            const pendingContact = localStorage.getItem('pendingTenantContact');
            if (userId && pendingContact) {
                const { data: linked, error: linkErr } = await supabase.rpc('link_tenant_to_user', {
                    p_user_id: userId,
                    p_contact: pendingContact,
                });
                localStorage.removeItem('pendingTenantContact');
                if (linkErr || !linked || linked.length === 0) {
                    setSignInError('Could not link your room. Check your contact number matches what the landlord entered.');
                    isProcessing.current = false;
                    setSignInLoading(false);
                    return;
                }
            }

            // Linking done — navigate to dashboard
            navigate('/tenant/dashboard', { replace: true });
        } catch (err) {
            setSignInError(err.message || 'Invalid email or password');
        } finally {
            isProcessing.current = false;
            setSignInLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setRegError('');
        if (regData.password.length < 6) { setRegError('Password must be at least 6 characters'); return; }
        if (!regData.contact.trim()) { setRegError('Contact number is required to link your room'); return; }

        setRegLoading(true);
        isProcessing.current = true;
        try {
            const { data } = await signUp({
                email: regData.email,
                password: regData.password,
                fullName: regData.fullName || regData.contact,
                role: 'tenant',
            });

            const userId = data?.user?.id;

            if (userId && data?.session) {
                // No email confirmation required — link immediately
                const { data: linked, error: linkErr } = await supabase.rpc('link_tenant_to_user', {
                    p_user_id: userId,
                    p_contact: regData.contact,
                });
                if (linkErr || !linked || linked.length === 0) {
                    setRegError('No tenant record found for this contact number. Please check with your landlord.');
                    isProcessing.current = false;
                    setRegLoading(false);
                    return;
                }
                navigate('/tenant/dashboard', { replace: true });
            } else {
                // Email confirmation required — store contact for post-confirmation linking
                localStorage.setItem('pendingTenantContact', regData.contact);
                setRegSuccess(true);
            }
        } catch (err) {
            setRegError(err.message || 'Failed to create account');
        } finally {
            isProcessing.current = false;
            setRegLoading(false);
        }
    };

    if (regSuccess) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
                    <div className="text-6xl mb-4">✅</div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Created!</h2>
                    <p className="text-gray-600 mb-2">
                        Check your email <strong>{regData.email}</strong> to confirm your account.
                    </p>
                    <p className="text-sm text-gray-500 mb-6">
                        After confirming, come back and Sign In — your room will be linked automatically.
                    </p>
                    <button
                        onClick={() => { setTab('signin'); setRegSuccess(false); }}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
                    >
                        Go to Sign In
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
                <div className="text-center mb-6">
                    <div className="text-5xl mb-3">🔑</div>
                    <h1 className="text-3xl font-bold text-gray-900">Tenant Portal</h1>
                    <p className="text-gray-500 mt-1">Sign in to view your room & payments</p>
                </div>

                {/* Tabs */}
                <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
                    {['signin', 'register'].map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`flex-1 py-2 text-sm font-semibold rounded-md transition ${tab === t ? 'bg-white text-blue-600 shadow' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {t === 'signin' ? 'Sign In' : 'First Time? Register'}
                        </button>
                    ))}
                </div>

                {/* Sign In Form */}
                {tab === 'signin' && (
                    <form onSubmit={handleSignIn} className="space-y-5">
                        {signInError && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{signInError}</div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input type="email" value={signInData.email}
                                onChange={(e) => setSignInData({ ...signInData, email: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                                placeholder="you@example.com" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <input type="password" value={signInData.password}
                                onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                                placeholder="••••••••" required />
                        </div>
                        <button type="submit" disabled={signInLoading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-60">
                            {signInLoading ? 'Signing in & linking...' : 'Sign In'}
                        </button>
                        <p className="text-center text-sm text-gray-500">
                            New here?{' '}
                            <button type="button" onClick={() => setTab('register')} className="text-blue-600 font-semibold hover:underline">
                                Register your account
                            </button>
                        </p>
                    </form>
                )}

                {/* Register Form */}
                {tab === 'register' && (
                    <form onSubmit={handleRegister} className="space-y-5">
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
                            💡 Enter your <strong>contact number exactly as your landlord recorded it</strong> to link your room.
                        </div>
                        {regError && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{regError}</div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                            <input type="text" value={regData.fullName}
                                onChange={(e) => setRegData({ ...regData, fullName: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                                placeholder="Your full name" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Contact Number <span className="text-red-500">*</span>
                            </label>
                            <input type="text" value={regData.contact}
                                onChange={(e) => setRegData({ ...regData, contact: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                                placeholder="Exactly as your landlord entered it" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                            <input type="email" value={regData.email}
                                onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                                placeholder="you@example.com" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Password <span className="text-gray-400 text-xs">(min 6 chars)</span>
                            </label>
                            <input type="password" value={regData.password}
                                onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
                                placeholder="••••••••" required />
                        </div>
                        <button type="submit" disabled={regLoading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition disabled:opacity-60">
                            {regLoading ? 'Creating & linking...' : 'Create Account & Link Room'}
                        </button>
                    </form>
                )}

                <div className="mt-6 text-center">
                    <Link to="/" className="text-sm text-gray-400 hover:text-gray-600">← Back to home</Link>
                </div>
            </div>
        </div>
    );
}
