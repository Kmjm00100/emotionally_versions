import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from "../contexts/AuthContext";
import Spinner from '../components/Spinner';
import { apiFetch } from '../api';

export default function RegisterPage(){
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [showPwd, setShowPwd] = useState(false);
	const [errors, setErrors] = useState({});
	const [loading, setLoading] = useState(false);
	const nav = useNavigate();
	const { showToast } = useToast();
	const { login, token, user } = useAuth();

	useEffect(() => {
		if (token || user) nav('/');
	}, [token, user, nav]);

	const validate = () => {
		const errs = {};
		if (!username.trim()) errs.username = 'Username is required';
		if (!password) errs.password = 'Password is required';
		else if (password.length < 6) errs.password = 'Password must be at least 6 characters';
		if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
		setErrors(errs);
		return Object.keys(errs).length === 0;
	};

	const onSubmit = async (e) => {
		e?.preventDefault();
		if (!validate()) return;
		setLoading(true);
		try {
			await apiFetch('/api/auth/register', {
				method: 'POST',
				body: JSON.stringify({ username, password })
			});
			// auto-login after registration
			const d = await apiFetch('/api/auth/login', {
				method: 'POST',
				body: JSON.stringify({ username, password })
			});
			login(d);
			showToast('Welcome!', { type: 'success' });
			nav('/');
		} catch (e) {
			const msg = e?.data?.error || e?.message || 'Registration failed';
			showToast(msg, { type: 'error' });
			setErrors(prev => ({ ...prev, form: msg }));
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="auth-container">
			<div className="auth-card">
				<h2 style={{ marginTop: 0 }}>Create Account</h2>
				<form className="form" onSubmit={onSubmit} noValidate>
					<div className="form-group">
						<label htmlFor="username">Username</label>
						<input
							id="username"
							autoComplete="username"
							value={username}
							onChange={e => setUsername(e.target.value)}
							placeholder="Choose a username"
						/>
						{errors.username && <div className="input-error">{errors.username}</div>}
					</div>

					<div className="form-group">
						<label htmlFor="password">Password</label>
						<div className="password-row">
							<input
								id="password"
								type={showPwd ? 'text' : 'password'}
								autoComplete="new-password"
								value={password}
								onChange={e => setPassword(e.target.value)}
								placeholder="At least 6 characters"
							/>
							<button
								type="button"
								className="btn secondary tiny"
								onClick={() => setShowPwd(s => !s)}
								aria-pressed={showPwd}
								style={{ marginLeft: 8 }}
							>
								{showPwd ? 'Hide' : 'Show'}
							</button>
						</div>
						{errors.password && <div className="input-error">{errors.password}</div>}
					</div>

					<div className="form-group">
						<label htmlFor="confirmPassword">Confirm Password</label>
						<input
							id="confirmPassword"
							type={showPwd ? 'text' : 'password'}
							autoComplete="new-password"
							value={confirmPassword}
							onChange={e => setConfirmPassword(e.target.value)}
							placeholder="Re-enter password"
						/>
						{errors.confirmPassword && <div className="input-error">{errors.confirmPassword}</div>}
					</div>

					{errors.form && <div className="input-error" role="alert">{errors.form}</div>}

					<button className="btn" type="submit" disabled={loading} aria-busy={loading}>
						{loading ? <Spinner /> : 'Register'}
					</button>
					<div className="helper">
						Already have an account? <Link to="/login">Login</Link>
					</div>
				</form>
			</div>
		</div>
	);
}