import React, { useState } from 'react';
import { Lock, User, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BRAND } from '../styles/colors';
import logoImg from '../../assets/logo.png';

const FEATURES = [
  { label: 'Supervision Zabbix',  desc: 'Services, uptime et réseau' },
  { label: 'Helpdesk GLPI',       desc: 'Tickets, délais et résolution' },
  { label: 'Rapports KPI',        desc: 'Export PDF et envoi par email' },
];

// ── input focus helper (controlled via onFocus/onBlur inline) ─────────────
const INPUT_BASE: React.CSSProperties = {
  width: '100%',
  fontSize: 13,
  color: '#0F172A',
  backgroundColor: '#F8FAFC',
  border: '1.5px solid #E2E8F0',
  borderRadius: 12,
  outline: 'none',
  transition: 'border-color 150ms, box-shadow 150ms, background-color 150ms',
  padding: '12px 40px',
};

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [userFocused, setUserFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
          ?? 'Identifiants invalides. Veuillez réessayer.',
      );
    } finally {
      setLoading(false);
    }
  };

  const focusStyle: React.CSSProperties = {
    borderColor: BRAND.darkBlue,
    backgroundColor: '#fff',
    boxShadow: `0 0 0 4px ${BRAND.darkBlue}18`,
  };

  const canSubmit = !loading && username.trim().length > 0 && password.length > 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>

      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between"
        style={{
          width: '46%',
          minHeight: '100vh',
          background: 'linear-gradient(175deg, #071929 0%, #0D2340 55%, #071929 100%)',
          position: 'relative',
          overflow: 'hidden',
          padding: '52px 56px',
        }}
      >
        {/* subtle dot grid — feels engineered, not AI-generated */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.07) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            pointerEvents: 'none',
          }}
        />

        {/* right-edge accent strip */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 3,
            height: '100%',
            background: `linear-gradient(to bottom, transparent, ${BRAND.green}80, ${BRAND.tealBlue}60, transparent)`,
          }}
        />

        {/* top: logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <img src={logoImg} alt="Arwamedic" style={{ height: 40, objectFit: 'contain' }} />
        </div>

        {/* middle: headline block */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* green bar */}
          <div style={{ width: 28, height: 3, background: BRAND.green, marginBottom: 28, borderRadius: 2 }} />

          <h1
            style={{
              fontSize: 48,
              fontWeight: 900,
              color: '#fff',
              lineHeight: 1.05,
              letterSpacing: '-1.5px',
              margin: '0 0 4px',
            }}
          >
            RKpi
          </h1>
          <h2
            style={{
              fontSize: 28,
              fontWeight: 300,
              color: 'rgba(255,255,255,0.45)',
              letterSpacing: '-0.5px',
              margin: '0 0 24px',
            }}
          >
            Dashboard
          </h2>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', lineHeight: 1.75, margin: '0 0 52px', maxWidth: 300 }}>
            Supervision de l'infrastructure IT et suivi des indicateurs de performance en temps réel.
          </p>

          {/* plain text feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {FEATURES.map(({ label, desc }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: BRAND.green,
                    marginTop: 7,
                    flexShrink: 0,
                  }}
                />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.82)', margin: '0 0 2px' }}>
                    {label}
                  </p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.30)', margin: 0 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* bottom: year + brand */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.20)', margin: 0, letterSpacing: '0.05em' }}>
            © {new Date().getFullYear()} ARWAMEDIC — DSI
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F1F5F9',
          padding: '32px 24px',
          minHeight: '100vh',
          position: 'relative',
        }}
      >
        {/* subtle background pattern */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `radial-gradient(circle at 80% 10%, ${BRAND.darkBlue}08 0%, transparent 50%),
                              radial-gradient(circle at 20% 90%, ${BRAND.green}06 0%, transparent 50%)`,
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>

          {/* mobile logo (hidden on lg) */}
          <div className="flex justify-center lg:hidden" style={{ marginBottom: 32 }}>
            <img src={logoImg} alt="Arwamedic" style={{ height: 44, objectFit: 'contain' }} />
          </div>

          {/* card */}
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: 24,
              padding: '40px 40px 36px',
              boxShadow: '0 8px 40px rgba(15,23,42,0.10), 0 1px 3px rgba(15,23,42,0.06)',
              border: '1px solid #E9EEF5',
            }}
          >
            {/* card header */}
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: BRAND.green, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>
                Bienvenue
              </p>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '0 0 6px' }}>
                Connexion
              </h2>
              <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
                Entrez vos identifiants pour accéder au tableau de bord.
              </p>
            </div>

            {/* error */}
            {error && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '12px 14px',
                  marginBottom: 22,
                  borderRadius: 12,
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                }}
              >
                <AlertCircle size={15} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: '#B91C1C', margin: 0, lineHeight: 1.5 }}>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* username */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
                  Identifiant
                </label>
                <div style={{ position: 'relative' }}>
                  <User
                    size={15}
                    color={userFocused ? BRAND.darkBlue : '#94A3B8'}
                    style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', transition: 'color 150ms' }}
                  />
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    onFocus={() => setUserFocused(true)}
                    onBlur={() => setUserFocused(false)}
                    placeholder="Nom d'utilisateur"
                    autoComplete="username"
                    disabled={loading}
                    style={{ ...INPUT_BASE, ...(userFocused ? focusStyle : {}) }}
                  />
                </div>
              </div>

              {/* password */}
              <div style={{ marginBottom: 28 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#475569', marginBottom: 8 }}>
                  Mot de passe
                </label>
                <div style={{ position: 'relative' }}>
                  <Lock
                    size={15}
                    color={passFocused ? BRAND.darkBlue : '#94A3B8'}
                    style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', transition: 'color 150ms' }}
                  />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    onFocus={() => setPassFocused(true)}
                    onBlur={() => setPassFocused(false)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={loading}
                    style={{ ...INPUT_BASE, paddingRight: 40, ...(passFocused ? focusStyle : {}) }}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPass(v => !v)}
                    style={{
                      position: 'absolute',
                      right: 13,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: '#94A3B8',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* submit */}
              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '13px 24px',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fff',
                  border: 'none',
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  background: canSubmit
                    ? `linear-gradient(135deg, ${BRAND.darkBlue} 0%, ${BRAND.mediumBlue} 100%)`
                    : '#CBD5E1',
                  boxShadow: canSubmit ? `0 4px 20px ${BRAND.darkBlue}40` : 'none',
                  transition: 'all 200ms',
                }}
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Connexion en cours…</>
                ) : 'Se connecter'}
              </button>
            </form>
          </div>

          {/* footer */}
          <p style={{ textAlign: 'center', fontSize: 11, color: '#94A3B8', marginTop: 24 }}>
            © {new Date().getFullYear()} Arwamedic · Tous droits réservés
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
