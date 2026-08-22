import { authApi } from '../services/api';

export default function LoginPage() {
  const handleGoogleLogin = () => {
    window.location.href = authApi.getGoogleLoginUrl();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="animate-fade-in w-full max-w-md">
        {}
        <div className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 p-8 border border-gray-100">
          {}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Login</h1>
          </div>

          {}
          <button
            onClick={handleGoogleLogin}
            id="google-login-btn"
            className="w-full flex items-center justify-center gap-3 bg-primary-500 hover:bg-primary-600
                       text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200
                       hover:shadow-lg hover:shadow-primary-500/25 active:scale-[0.98] mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#fff"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff"/>
            </svg>
            Login with Google
          </button>

          {}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">or sign up through email</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {}
          <div className="space-y-4 mb-6">
            <div>
              <input
                type="email"
                placeholder="Email ID"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-700
                           placeholder-gray-400 focus:outline-none focus:border-primary-400
                           focus:ring-2 focus:ring-primary-100 transition-all duration-200"
                disabled
              />
            </div>
            <div>
              <input
                type="password"
                placeholder="Password"
                className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-gray-700
                           placeholder-gray-400 focus:outline-none focus:border-primary-400
                           focus:ring-2 focus:ring-primary-100 transition-all duration-200"
                disabled
              />
            </div>
          </div>

          {}
          <button
            onClick={handleGoogleLogin}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 px-6
                       rounded-lg transition-all duration-200 hover:shadow-lg
                       hover:shadow-primary-500/25 active:scale-[0.98]"
          >
            Login
          </button>
        </div>

        {}
        <p className="text-center text-xs text-gray-400 mt-6">
          Only Google OAuth is supported for authentication
        </p>
      </div>
    </div>
  );
}
