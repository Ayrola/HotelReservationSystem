import { pages } from '../pages/entries.js';

const destinations = new Set([...pages.map(page => page.path), '/hotel/', '/hotels/']);
destinations.delete('/pages/login/'); destinations.delete('/pages/register/');
export function safeAuthReturn(value, fallback = '/hotels/') {
  if (!value || value.length > 4096 || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const url = new URL(value, 'https://return.invalid');
    if (url.origin !== 'https://return.invalid' || !destinations.has(url.pathname)) return fallback;
    return url.pathname + url.search;
  } catch { return fallback; }
}
export function authPageLink(mode, next) {
  return `/pages/${mode === 'register' ? 'register' : 'login'}/?${new URLSearchParams({ next:safeAuthReturn(next) })}`;
}
export function validateRegistration({ displayName, password, confirmPassword }) {
  const errors = {};
  if (!displayName.trim() || displayName.trim().length > 100) errors.displayName = 'Enter a name of 1–100 characters.';
  if (password.length < 6) errors.password = 'Use at least 6 characters. The server may require a stronger password.';
  if (password !== confirmPassword) errors.confirmPassword = 'Passwords must match.';
  return errors;
}
export function authErrorMessage(error) {
  const messages = {
    invalid_credentials:'Email or password is incorrect.',
    email_not_confirmed:'Confirm your email before logging in. Check your inbox for the confirmation link.',
    weak_password:'This password does not meet the project’s password requirements. Choose a stronger password.',
    user_already_exists:'Registration could not be completed. Try logging in if you already have an account.',
    email_address_invalid:'Enter a valid email address.',
    email_address_not_authorized:'A confirmation email could not be sent to this address. Contact the site administrator.',
    signup_disabled:'Registration is currently unavailable.',
    over_email_send_rate_limit:'Too many email requests. Please wait before trying again.',
    over_request_rate_limit:'Too many attempts. Please wait before trying again.',
    captcha_failed:'The server requires additional verification. Contact the site administrator.',
  };
  return Object.hasOwn(messages,error?.code) ? messages[error.code] : 'We could not complete this request. Please try again.';
}
