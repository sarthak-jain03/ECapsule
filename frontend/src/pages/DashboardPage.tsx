import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { emailApi } from '../services/api';
import { EmailJob, EmailStats } from '../types';
import { format } from 'date-fns';

type Tab = 'scheduled' | 'sent';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('scheduled');
  const [emails, setEmails] = useState<EmailJob[]>([]);
  const [stats, setStats] = useState<EmailStats>({ scheduled: 0, sent: 0, failed: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<EmailJob | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [emailData, statsData] = await Promise.all([
        activeTab === 'scheduled' ? emailApi.getScheduled() : emailApi.getSent(),
        emailApi.getStats(),
      ]);
      setEmails(emailData.data);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      SCHEDULED: 'bg-amber-100 text-amber-700 border-amber-200',
      QUEUED: 'bg-blue-100 text-blue-700 border-blue-200',
      SENDING: 'bg-purple-100 text-purple-700 border-purple-200',
      SENT: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      FAILED: 'bg-red-100 text-red-700 border-red-200',
      RATE_LIMITED: 'bg-orange-100 text-orange-700 border-orange-200',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || 'bg-gray-100 text-gray-600'}`}>
        {status === 'RATE_LIMITED' ? 'Rate Limited' : status.charAt(0) + status.slice(1).toLowerCase()}
      </span>
    );
  };

  const formatTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'MMM d, h:mm a');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="h-screen flex bg-white">
      {}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {}
        <div className="px-5 py-5 border-b border-gray-100">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">ON8</h1>
        </div>

        {}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-9 h-9 rounded-full object-cover ring-2 ring-primary-100"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-white font-semibold text-sm">
                {user?.name?.charAt(0) || 'U'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-400 hover:text-red-500 transition-colors p-1"
              title="Logout"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {}
        <div className="px-4 py-4">
          <button
            onClick={() => navigate('/compose')}
            id="compose-btn"
            className="w-full flex items-center justify-center gap-2 bg-primary-500 hover:bg-primary-600
                       text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200
                       hover:shadow-lg hover:shadow-primary-500/25 active:scale-[0.98]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Compose
          </button>
        </div>

        {}
        <nav className="px-3 flex-1">
          <button
            onClick={() => setActiveTab('scheduled')}
            id="tab-scheduled"
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 mb-1 ${
              activeTab === 'scheduled'
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Scheduled
            </div>
            {stats.scheduled > 0 && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                activeTab === 'scheduled'
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {stats.scheduled}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('sent')}
            id="tab-sent"
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === 'sent'
                ? 'bg-primary-50 text-primary-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Sent
            </div>
            {stats.sent > 0 && (
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                activeTab === 'sent'
                  ? 'bg-primary-500 text-white'
                  : 'bg-gray-200 text-gray-600'
              }`}>
                {stats.sent}
              </span>
            )}
          </button>
        </nav>

        {}
        <div className="px-4 py-3 border-t border-gray-100">
          <button
            onClick={fetchData}
            className="w-full flex items-center justify-center gap-2 text-xs text-gray-400
                       hover:text-gray-600 transition-colors py-1.5"
          >
            <svg className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </aside>

      {}
      <main className="flex-1 flex flex-col overflow-hidden">
        {}
        <header className="h-14 border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search..."
                className="w-64 pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg
                           focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100
                           transition-all duration-200 bg-gray-50"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
            <button onClick={fetchData} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-all">
              <svg className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </header>

        {}
        <div className="flex-1 overflow-y-auto">
          {isLoading && emails.length === 0 ? (

            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 text-sm">Loading emails...</p>
            </div>
          ) : emails.length === 0 ? (

            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-700 mb-1">
                  No {activeTab} emails
                </h3>
                <p className="text-sm text-gray-400">
                  {activeTab === 'scheduled'
                    ? 'Schedule your first email campaign to get started'
                    : 'Sent emails will appear here'}
                </p>
              </div>
              {activeTab === 'scheduled' && (
                <button
                  onClick={() => navigate('/compose')}
                  className="mt-2 bg-primary-500 hover:bg-primary-600 text-white font-medium
                             py-2 px-5 rounded-lg text-sm transition-all hover:shadow-lg
                             hover:shadow-primary-500/25 active:scale-[0.98]"
                >
                  Compose Email
                </button>
              )}
            </div>
          ) : (

            <div className="divide-y divide-gray-100">
              {emails.map((email, index) => (
                <div
                  key={email.id}
                  onClick={() => setSelectedEmail(selectedEmail?.id === email.id ? null : email)}
                  className={`stagger-item flex items-center gap-4 px-6 py-3.5 cursor-pointer transition-all duration-200
                    ${selectedEmail?.id === email.id
                      ? 'bg-primary-50/50 border-l-2 border-l-primary-500'
                      : 'hover:bg-gray-50 border-l-2 border-l-transparent'
                    }`}
                  style={{ animationDelay: `${index * 0.03}s` }}
                >
                  {}
                  <div className="min-w-0 w-44 flex-shrink-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      To: {email.recipientEmail}
                    </p>
                  </div>

                  {}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getStatusBadge(email.status)}
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {activeTab === 'sent' && email.sentAt
                        ? formatTime(email.sentAt)
                        : formatTime(email.scheduledAt)}
                    </span>
                  </div>

                  {}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-700 truncate">
                      <span className="font-medium">{email.subject}</span>
                      <span className="text-gray-400 ml-2">
                        — {email.body.replace(/<[^>]*>/g, '').substring(0, 80)}
                      </span>
                    </p>
                  </div>

                  {}
                  {email.etherealPreviewUrl && (
                    <a
                      href={email.etherealPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex-shrink-0 text-primary-500 hover:text-primary-700 transition-colors"
                      title="View in Ethereal"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {}
      {selectedEmail && (
        <aside className="w-[480px] border-l border-gray-200 bg-white flex flex-col animate-slide-right overflow-hidden">
          {}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setSelectedEmail(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h2 className="text-sm font-semibold text-gray-900 truncate">{selectedEmail.subject}</h2>
            </div>
            {getStatusBadge(selectedEmail.status)}
          </div>

          {}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm">
                {selectedEmail.senderEmail.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{selectedEmail.senderEmail}</p>
                <p className="text-xs text-gray-400">
                  to {selectedEmail.recipientEmail}
                </p>
              </div>
              <span className="ml-auto text-xs text-gray-400">
                {selectedEmail.sentAt
                  ? formatTime(selectedEmail.sentAt)
                  : formatTime(selectedEmail.scheduledAt)}
              </span>
            </div>

            {}
            <div
              className="prose prose-sm max-w-none text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
            />

            {}
            {selectedEmail.etherealPreviewUrl && (
              <div className="mt-6 p-3 bg-primary-50 rounded-lg border border-primary-100">
                <a
                  href={selectedEmail.etherealPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-medium text-primary-700 hover:text-primary-800"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  View in Ethereal Email
                </a>
              </div>
            )}

            {}
            {selectedEmail.errorMessage && (
              <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100">
                <p className="text-sm text-red-700">
                  <span className="font-medium">Error:</span> {selectedEmail.errorMessage}
                </p>
              </div>
            )}

            {}
            <div className="mt-6 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-gray-400 mb-0.5">Scheduled At</p>
                  <p className="text-gray-700 font-medium">{formatTime(selectedEmail.scheduledAt)}</p>
                </div>
                {selectedEmail.sentAt && (
                  <div>
                    <p className="text-gray-400 mb-0.5">Sent At</p>
                    <p className="text-gray-700 font-medium">{formatTime(selectedEmail.sentAt)}</p>
                  </div>
                )}
                <div>
                  <p className="text-gray-400 mb-0.5">Campaign ID</p>
                  <p className="text-gray-700 font-mono text-xs">{selectedEmail.campaignId.substring(0, 8)}...</p>
                </div>
                <div>
                  <p className="text-gray-400 mb-0.5">Job ID</p>
                  <p className="text-gray-700 font-mono text-xs">{selectedEmail.id.substring(0, 8)}...</p>
                </div>
              </div>
            </div>
          </div>
        </aside>
      )}
    </div>
  );
}
