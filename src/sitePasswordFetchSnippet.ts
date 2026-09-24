/**
 * Fetch wrapper:
 * - same-origin /api/* → cookie Pages (credentials), bez hasła w storage
 * - legacy workers.dev → opcjonalny X-Site-Password z localStorage (TTL), bez pętli przy mismatch
 */
export const SITE_PASSWORD_FETCH_SNIPPET = `(function () {
  var KEY = 'zwrotka_site_password';
  var reauthPending = false;
  var mismatchAlerted = false;

  function isProxyUrl(url) {
    return url.indexOf('/api/transport') !== -1 ||
      url.indexOf('/api/formatka') !== -1 ||
      url.indexOf('workers.dev') !== -1;
  }

  function isWorkersDev(url) {
    return url.indexOf('workers.dev') !== -1;
  }

  function readLegacyPass() {
    try {
      var raw = localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || '';
      if (!raw) return '';
      if (raw.charAt(0) === '{') {
        var obj = JSON.parse(raw);
        if (!obj || !obj.p) return '';
        if (obj.exp && Date.now() > Number(obj.exp)) {
          clearLegacyPass();
          return '';
        }
        return String(obj.p);
      }
      return raw;
    } catch (e) {
      return '';
    }
  }

  function clearLegacyPass() {
    try {
      sessionStorage.removeItem(KEY);
      localStorage.removeItem(KEY);
    } catch (e) {}
  }

  function forceReauth() {
    if (reauthPending) return;
    reauthPending = true;
    clearLegacyPass();
    location.assign('/logout');
  }

  function maybeMismatchAlert(res) {
    if (mismatchAlerted || res.status !== 503) return;
    mismatchAlerted = true;
    res.clone().json().then(function (body) {
      if (body && body.error === 'proxy_auth_mismatch') {
        alert('Błąd konfiguracji serwera: hasło Pages i Worker się różnią. Skontaktuj się z administratorem.');
      }
    }).catch(function () {});
  }

  var _fetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    init = init ? Object.assign({}, init) : {};
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var proxy = isProxyUrl(url);
    if (proxy) {
      if (isWorkersDev(url)) {
        var pass = readLegacyPass();
        if (pass) {
          var h = init.headers;
          if (!h) {
            init.headers = { 'X-Site-Password': pass };
          } else if (typeof Headers !== 'undefined' && h instanceof Headers) {
            h.set('X-Site-Password', pass);
          } else {
            init.headers = Object.assign({}, h, { 'X-Site-Password': pass });
          }
        }
      }
      if (init.credentials == null) init.credentials = 'include';
    }
    return _fetch(input, init).then(function (res) {
      if (!proxy) return res;
      if (res.status === 401) {
        forceReauth();
        return res;
      }
      maybeMismatchAlert(res);
      return res;
    });
  };
})();
`;
