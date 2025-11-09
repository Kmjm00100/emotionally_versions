import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import Spinner from '../components/Spinner';
import { apiFetch } from '../api';

export default function LoginPage(){
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [showPwd, setShowPwd] = useState(false);
	const [errors, setErrors] = useState({});
	const [loading, setLoading] = useState(false);
	const nav = useNavigate();
	const { login, token, user } = useAuth();
	const { showToast } = useToast();

	useEffect(() => {
		if (token || user) nav('/');
	}, [token, user, nav]);

	const validate = () => {
		const errs = {};
		if (!username.trim()) errs.username = 'Username is required';
		if (!password) errs.password = 'Password is required';
		setErrors(errs);
		return Object.keys(errs).length === 0;
	};

	const onSubmit = async (e) => {
		e?.preventDefault();
		if (!validate()) return;
		setLoading(true);
		try {
			const d = await apiFetch('/api/auth/login', {
				method: 'POST',
				body: JSON.stringify({ username, password })
			});
			login(d);
			showToast('Welcome back!', { type: 'success' });
			nav('/');
		} catch (e) {
			const msg = e?.data?.error || e?.message || 'Login failed';
			showToast(msg, { type: 'error' });
			setErrors(prev => ({ ...prev, form: msg }));
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="auth-container">
			<div className="auth-card">
				<h2 style={{ marginTop: 0 }}>Sign in</h2>
				<form className="form" onSubmit={onSubmit} noValidate>
					<div className="form-group">
						<label htmlFor="username">Username</label>
						<input
							id="username"
							autoComplete="username"
							value={username}
							onChange={e => setUsername(e.target.value)}
							placeholder="Enter your username"
						/>
						{errors.username && <div className="input-error">{errors.username}</div>}
					</div>

					<div className="form-group">
						<label htmlFor="password">Password</label>
						<div className="password-row">
							<input
								id="password"
								type={showPwd ? 'text' : 'password'}
								autoComplete="current-password"
								value={password}
								onChange={e => setPassword(e.target.value)}
								placeholder="Enter your password"
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

					{errors.form && <div className="input-error" role="alert">{errors.form}</div>}

					<button className="btn" type="submit" disabled={loading} aria-busy={loading}>
						{loading ? <Spinner /> : 'Login'}
					</button>
					<div className="helper">
						Don't have an account? <Link to="/register">Register</Link>
					</div>
				</form>
			</div>
		</div>
	);
}