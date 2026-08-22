import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { emailApi } from '../services/api';
import toast from 'react-hot-toast';
import { format, addDays, setHours, setMinutes } from 'date-fns';

export default function ComposePage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [senderEmail, setSenderEmail] = useState('outreach@reachinbox.io');
  const [recipients, setRecipients] = useState<string[]>([]);
  const [recipientInput, setRecipientInput] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delayBetween, setDelayBetween] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSchedulePopover, setShowSchedulePopover] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');
  const [customDateTime, setCustomDateTime] = useState('');

  const [isUploading, setIsUploading] = useState(false);

  const tomorrow = addDays(new Date(), 1);
  const quickOptions = [
    { label: 'Tomorrow', value: setHours(setMinutes(tomorrow, 0), 9).toISOString() },
    { label: 'Tomorrow, 10:00 AM', value: setHours(setMinutes(tomorrow, 0), 10).toISOString() },
    { label: 'Tomorrow, 11:00 AM', value: setHours(setMinutes(tomorrow, 0), 11).toISOString() },
    { label: 'Tomorrow, 3:00 PM', value: setHours(setMinutes(tomorrow, 0), 15).toISOString() },
  ];

  const addRecipient = () => {
    const email = recipientInput.trim().toLowerCase();
    if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !recipients.includes(email)) {
      setRecipients([...recipients, email]);
      setRecipientInput('');
    }
  };

  const handleRecipientKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      addRecipient();
    }
    if (e.key === 'Backspace' && !recipientInput && recipients.length > 0) {
      setRecipients(recipients.slice(0, -1));
    }
  };

  const removeRecipient = (email: string) => {
    setRecipients(recipients.filter((r) => r !== email));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const result = await emailApi.parseCsv(file);
      const newEmails = result.emails.filter((e) => !recipients.includes(e));
      setRecipients([...recipients, ...newEmails]);
      toast.success(`${result.count} email addresses found, ${newEmails.length} new added`);
    } catch (err) {
      toast.error('Failed to parse CSV file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSchedule = async (startTime?: string) => {
    if (recipients.length === 0) {
      toast.error('Add at least one recipient');
      return;
    }
    if (!subject.trim()) {
      toast.error('Subject is required');
      return;
    }
    if (!body.trim()) {
      toast.error('Email body is required');
      return;
    }

    const sendTime = startTime || scheduledTime || new Date().toISOString();

    setIsSubmitting(true);
    try {
      const result = await emailApi.schedule({
        recipients,
        subject,
        body,
        senderEmail,
        startTime: sendTime,
        delayBetweenEmails: delayBetween,
        hourlyLimit,
      });

      toast.success(`Scheduled ${result.jobCount} emails successfully!`);
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to schedule emails');
    } finally {
      setIsSubmitting(false);
      setShowSchedulePopover(false);
    }
  };

  const handleSendNow = () => {

    const now = new Date(Date.now() + 5000).toISOString();
    handleSchedule(now);
  };

  const displayedRecipients = recipients.slice(0, 3);
  const remainingCount = recipients.length - 3;

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {}
      <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900">Compose New Email</h1>
        </div>

        <div className="flex items-center gap-3">
          {}
          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-all relative">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            {recipients.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {recipients.length}
              </span>
            )}
          </button>

          {}
          <div className="relative">
            <button
              onClick={() => setShowSchedulePopover(!showSchedulePopover)}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {}
            {showSchedulePopover && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSchedulePopover(false)} />
                <div className="absolute right-0 top-12 z-50 w-72 bg-white rounded-xl shadow-2xl shadow-gray-200/80 border border-gray-100 animate-scale-in overflow-hidden">
                  <div className="px-4 pt-4 pb-2">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Send Later</h3>
                    <input
                      type="datetime-local"
                      value={customDateTime}
                      onChange={(e) => setCustomDateTime(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                                 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 mb-2"
                      min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                    />
                    {customDateTime && (
                      <button
                        onClick={() => handleSchedule(new Date(customDateTime).toISOString())}
                        disabled={isSubmitting}
                        className="w-full text-center py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors mb-1"
                      >
                        {isSubmitting ? 'Scheduling...' : 'Schedule for this time'}
                      </button>
                    )}
                  </div>
                  <div className="border-t border-gray-100">
                    {quickOptions.map((option) => (
                      <button
                        key={option.label}
                        onClick={() => handleSchedule(option.value)}
                        disabled={isSubmitting}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-gray-100 px-4 py-3 flex justify-end gap-2">
                    <button
                      onClick={() => setShowSchedulePopover(false)}
                      className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        if (customDateTime) {
                          handleSchedule(new Date(customDateTime).toISOString());
                        }
                      }}
                      disabled={!customDateTime || isSubmitting}
                      className="px-4 py-1.5 text-sm font-medium bg-primary-500 text-white rounded-lg
                                 hover:bg-primary-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {}
          <button
            onClick={handleSendNow}
            disabled={isSubmitting}
            id="send-btn"
            className="flex items-center gap-1.5 bg-white border-2 border-primary-500 text-primary-600
                       font-semibold py-1.5 px-5 rounded-full text-sm hover:bg-primary-500 hover:text-white
                       transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Sending...' : 'Send'}
          </button>
        </div>
      </header>

      {}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto py-6 px-8">
          {}
          <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-100">
            <label className="text-sm font-medium text-gray-500 w-16">From</label>
            <div className="flex-1">
              <select
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                className="bg-gray-100 text-sm text-gray-700 font-medium px-3 py-1.5 rounded-lg
                           border-none focus:outline-none focus:ring-2 focus:ring-primary-200 cursor-pointer"
              >
                <option value="outreach@reachinbox.io">outreach@reachinbox.io</option>
                <option value="sales@reachinbox.io">sales@reachinbox.io</option>
                <option value="support@reachinbox.io">support@reachinbox.io</option>
              </select>
            </div>
          </div>

          {}
          <div className="flex items-start gap-4 mb-4 pb-4 border-b border-gray-100">
            <label className="text-sm font-medium text-gray-500 w-16 pt-1.5">To</label>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-1.5 min-h-[36px]">
                {displayedRecipients.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border-2 border-primary-300
                               text-primary-700 rounded-full text-xs font-medium animate-scale-in"
                  >
                    {email}
                    <button
                      onClick={() => removeRecipient(email)}
                      className="text-primary-400 hover:text-primary-700 transition-colors ml-0.5"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
                {remainingCount > 0 && (
                  <span className="inline-flex items-center px-2.5 py-1 bg-primary-50 border-2 border-primary-200
                                   text-primary-600 rounded-full text-xs font-semibold">
                    +{remainingCount}
                  </span>
                )}
                <input
                  type="text"
                  value={recipientInput}
                  onChange={(e) => setRecipientInput(e.target.value)}
                  onKeyDown={handleRecipientKeyDown}
                  onBlur={addRecipient}
                  placeholder={recipients.length === 0 ? 'recipient@example.com' : ''}
                  className="flex-1 min-w-[200px] text-sm text-gray-700 placeholder-gray-400
                             focus:outline-none py-1"
                />
              </div>
            </div>
            {}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700
                         transition-colors whitespace-nowrap flex-shrink-0 pt-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {isUploading ? 'Uploading...' : 'Upload List'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.xlsx"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {}
          <div className="flex items-center gap-4 mb-4 pb-4 border-b border-gray-100">
            <label className="text-sm font-medium text-gray-500 w-16">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className="flex-1 text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
            />
          </div>

          {}
          <div className="flex items-center gap-6 mb-6 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-500 whitespace-nowrap">
                Delay between 2 emails
              </label>
              <input
                type="number"
                value={delayBetween}
                onChange={(e) => setDelayBetween(Math.max(0, parseInt(e.target.value) || 0))}
                min={0}
                className="w-16 text-center text-sm border border-gray-200 rounded-lg py-1.5
                           focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
              <span className="text-xs text-gray-400">sec</span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-500 whitespace-nowrap">
                Hourly Limit
              </label>
              <input
                type="number"
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                className="w-16 text-center text-sm border border-gray-200 rounded-lg py-1.5
                           focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              />
              <span className="text-xs text-gray-400">/hr</span>
            </div>
          </div>

          {}
          <div className="mb-6">
            {}
            <div className="flex items-center gap-1 pb-3 mb-3 border-b border-gray-100 flex-wrap">
              {['undo', 'redo'].map((action) => (
                <button key={action} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {action === 'undo' ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a5 5 0 00-5 5v2m15-7l-4-4m4 4l-4 4" />
                    )}
                  </svg>
                </button>
              ))}
              <div className="w-px h-5 bg-gray-200 mx-1" />
              <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-all text-xs font-medium">
                Tt
              </button>
              <div className="w-px h-5 bg-gray-200 mx-1" />
              {['B', 'I', 'U'].map((format) => (
                <button key={format} className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-all text-xs font-semibold w-7 h-7 flex items-center justify-center">
                  {format === 'I' ? <em>{format}</em> : format === 'U' ? <u>{format}</u> : format}
                </button>
              ))}
              <div className="w-px h-5 bg-gray-200 mx-1" />
              {['alignLeft', 'alignCenter', 'alignRight'].map((align) => (
                <button key={align} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              ))}
              <div className="w-px h-5 bg-gray-200 mx-1" />
              {['list-ordered', 'list-unordered'].map((list) => (
                <button key={list} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                </button>
              ))}
            </div>

            {}
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your Reply..."
              rows={14}
              className="w-full text-sm text-gray-700 placeholder-gray-400 focus:outline-none
                         resize-none leading-relaxed bg-gray-50 rounded-lg p-4 border border-gray-100
                         focus:border-primary-200 focus:bg-white transition-all duration-200"
            />
          </div>

          {}
          {recipients.length > 0 && (
            <div className="bg-primary-50/50 border border-primary-100 rounded-lg p-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="text-sm font-medium text-primary-700">
                    {recipients.length} recipient{recipients.length !== 1 ? 's' : ''} ready
                  </span>
                </div>
                <button
                  onClick={() => setRecipients([])}
                  className="text-xs text-primary-500 hover:text-primary-700 font-medium transition-colors"
                >
                  Clear all
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
